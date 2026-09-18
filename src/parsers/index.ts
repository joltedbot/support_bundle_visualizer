import type { BundleData } from '../utils/bundleReader'
import { parseJsonFile } from '../utils/bundleReader'
import type { BundleModel } from './types'
import { parseManifest } from './manifest'
import { parseHealth } from './health'
import { parseInternalHealth } from './internalHealth'
import { parseAuth } from './auth'
import { parseNodes, buildNodeHealthSignals } from './nodes'
import { parseIndices } from './indices'
import { parseShards } from './shards'
import { parseStats } from './stats'
import { parseILM, buildIndexPolicyMap } from './ilm'
import { buildIndexModelMap } from './indexModels'
import { parseML } from './ml'
import { parseFeatures } from './features'
import { parseReplication } from './replication'
import { parseSnapshots } from './snapshots'
import { parseSizing } from './sizing'
import { parseLicense } from './license'
import { parsePlugins } from './plugins'
import { parseDataStreams } from './datastreams'
import { parsePipelines } from './pipelines'
import { parseClusterSettings } from './clusterSettings'
import { parsePendingTasks } from './pendingTasks'

export async function parseBundle(data: BundleData): Promise<BundleModel> {
  const { files } = data

  // Parse manifest early so we can pass collectionDateMs to sub-parsers
  const identity = parseManifest(files)
  const parsedCollectionDate = identity?.collectionTimestamp
    ? new Date(identity.collectionTimestamp).getTime()
    : null
  const collectionDateMs = parsedCollectionDate !== null && !isNaN(parsedCollectionDate)
    ? parsedCollectionDate
    : null

  // Build alias-backed index set from alias.json
  const aliasJson = parseJsonFile<Record<string, { aliases?: Record<string, unknown> }>>(
    files,
    'alias.json'
  )
  const aliasBackedIndices = new Set<string>()
  if (aliasJson) {
    for (const [indexName, entry] of Object.entries(aliasJson)) {
      if (entry.aliases && Object.keys(entry.aliases).length > 0) {
        aliasBackedIndices.add(indexName)
      }
    }
  }

  const rawIndices = parseIndices(files, aliasBackedIndices)

  // Join ILM policy names onto each index
  const indexPolicyMap = buildIndexPolicyMap(files)
  // Join model names onto each index
  const indexModelMap = buildIndexModelMap(files)

  // Build LogsDB detection map from settings.json
  const settingsRaw = parseJsonFile<Record<string, {
    settings?: { index?: { mode?: string; mapping?: { source?: { mode?: string } } } }
  }>>(files, 'settings.json')
  const logsDbSet = new Set<string>()
  if (settingsRaw) {
    for (const [indexName, entry] of Object.entries(settingsRaw)) {
      const idx = entry?.settings?.index
      const indexMode = idx?.mode
      const sourceMode = idx?.mapping?.source?.mode
      if (indexMode === 'logsdb' || sourceMode === 'synthetic') {
        logsDbSet.add(indexName)
      }
    }
  }

  const indices = rawIndices.map((idx) => {
    const policy = indexPolicyMap.get(idx.name)
    const models = indexModelMap.get(idx.name)
    let updated = idx
    if (policy) updated = { ...updated, ilmPolicy: policy }
    if (models) updated = { ...updated, models }
    if (logsDbSet.has(idx.name)) updated = { ...updated, isLogsDb: true }
    return updated
  })

  // Parse features and aiMl separately so we can merge semantic/vector counts
  const features = parseFeatures(files, indices)
  const aiMlBase = parseML(files, indices)
  const aiMl = aiMlBase ? {
    ...aiMlBase,
    semanticTextIndexCount: features?.semanticTextIndexCount ?? 0,
    denseVectorIndexCount: features?.denseVectorIndexCount ?? 0,
    sparseVectorIndexCount: features?.sparseVectorIndexCount ?? 0,
  } : null

  const nodes = parseNodes(files)
  const rawShards = parseShards(files)

  // Build name→id map so shard joins use stable node IDs, not display names
  const nodeNameToId = new Map<string, string>()
  for (const node of nodes) {
    nodeNameToId.set(node.name, node.id)
  }

  // Resolve ShardInfo.nodeId — undefined when join fails; never backfill with name
  const shards = rawShards.map((shard) => {
    const nodeId = shard.node ? nodeNameToId.get(shard.node) : undefined
    return nodeId !== undefined ? { ...shard, nodeId } : shard
  })

  // Compute shard counts and snapshot dataset totals per node ID
  const shardCountsByNode = new Map<string, number>()
  const snapshotDataByNode = new Map<string, number>()
  for (const shard of shards) {
    if (shard.nodeId) {
      shardCountsByNode.set(shard.nodeId, (shardCountsByNode.get(shard.nodeId) ?? 0) + 1)
      // dataset > store means the shard lives on a searchable snapshot (remote storage)
      if (shard.datasetSizeBytes > shard.storeSizeBytes) {
        snapshotDataByNode.set(shard.nodeId, (snapshotDataByNode.get(shard.nodeId) ?? 0) + shard.datasetSizeBytes)
      }
    }
  }

  // Build shared cache size map from commercial/searchable_snapshots_cache_stats.json (keyed by node ID)
  interface CacheStatsJson {
    nodes?: Record<string, { shared_cache?: { size_in_bytes?: number } }>
  }
  const cacheStatsJson = parseJsonFile<CacheStatsJson>(files, 'commercial/searchable_snapshots_cache_stats.json')
  const sharedCacheByNodeId = new Map<string, number>()
  if (cacheStatsJson?.nodes) {
    for (const [id, nodeStats] of Object.entries(cacheStatsJson.nodes)) {
      const size = nodeStats.shared_cache?.size_in_bytes
      if (size !== undefined) sharedCacheByNodeId.set(id, size)
    }
  }

  const DATA_TIERS = new Set(['hot', 'warm', 'cold', 'frozen'])
  const nodesWithShardCounts = nodes.map((node) => {
    const count = shardCountsByNode.get(node.id)
    const snapshotData = snapshotDataByNode.get(node.id)
    // Always set shardCount for data-tier nodes so 0-shard nodes render the bar
    const updates: Partial<typeof node> = {}
    if (count !== undefined || DATA_TIERS.has(node.tier)) {
      updates.shardCount = count ?? 0
    }
    if (snapshotData !== undefined) {
      updates.snapshotDataBytes = snapshotData
    }
    // For frozen nodes, always record snapshot data (0 when absent) and shared cache size
    if (node.tier === 'frozen') {
      updates.snapshotDataBytes = snapshotData ?? 0
      const cacheSize = sharedCacheByNodeId.get(node.id)
      if (cacheSize !== undefined) updates.sharedCacheSizeBytes = cacheSize
    }
    return Object.keys(updates).length > 0 ? { ...node, ...updates } : node
  })

  // Compute tier storage via shard-to-node join (keyed by node ID)
  const nodeTierMap = new Map<string, string>()
  for (const node of nodes) {
    nodeTierMap.set(node.id, node.tier)
  }
  const tierStorageMap: Record<string, number> = {}
  for (const shard of shards) {
    if (shard.nodeId) {
      const tier = nodeTierMap.get(shard.nodeId)
      if (tier) {
        tierStorageMap[tier] = (tierStorageMap[tier] ?? 0) + shard.storeSizeBytes
      }
    }
  }

  const tierStorage = Object.keys(tierStorageMap).length > 0 ? tierStorageMap : null

  return {
    identity,
    health: parseHealth(files),
    internalHealth: parseInternalHealth(files),
    auth: parseAuth(files),
    nodes: nodesWithShardCounts,
    indices,
    shards,
    stats: parseStats(files),
    ilm: parseILM(files),
    aiMl,
    features,
    replication: parseReplication(files),
    snapshots: parseSnapshots(files, collectionDateMs),
    sizing: parseSizing(files, indices),
    license: parseLicense(files),
    plugins: parsePlugins(files),
    dataStreams: parseDataStreams(files),
    ingestPipelines: parsePipelines(files),
    clusterSettings: parseClusterSettings(files),
    tierStorage,
    nodeHealthSignals: buildNodeHealthSignals(files, nodesWithShardCounts),
    pendingTasks: parsePendingTasks(files),
  }
}

export type { BundleModel } from './types'
