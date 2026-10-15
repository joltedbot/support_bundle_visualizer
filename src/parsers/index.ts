import type { BundleData } from '../utils/bundleReader'
import { parseJsonFile } from '../utils/bundleReader'
import type { BundleModel } from './types'
import { parseManifest } from './manifest'
import { parseHealth } from './health'
import { parseInternalHealth } from './internalHealth'
import { parseAuth } from './auth'
import { parseNodes, buildNodeHealthSignals } from './nodes'
import { parseIndices } from './indices'
import { parseIndexTraits } from './indexTraits'
import type { IndexTraits } from './indexTraits'
import { buildDataAdoption } from './dataAdoption'
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

interface CacheStatsJson {
  nodes?: Record<string, { shared_cache?: { size_in_bytes?: number } }>
}

const DATA_TIERS = new Set(['hot', 'warm', 'cold', 'frozen'])

// Parsers must never throw: a wrong-shaped file (null entries, strings where objects are
// expected) must not abort generation, so every sub-parser runs behind this guard.
function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch {
    return fallback
  }
}

export async function parseBundle(data: BundleData): Promise<BundleModel> {
  const { files } = data

  // Parse manifest early so we can pass collectionDateMs to sub-parsers
  const identity = safe(() => parseManifest(files), null)
  const parsedCollectionDate = identity?.collectionTimestamp
    ? new Date(identity.collectionTimestamp).getTime()
    : null
  const collectionDateMs = parsedCollectionDate !== null && !isNaN(parsedCollectionDate)
    ? parsedCollectionDate
    : null

  // Build alias-backed index set from alias.json
  const aliasJson = parseJsonFile<Record<string, { aliases?: Record<string, unknown> } | null>>(
    files,
    'alias.json'
  )
  const aliasBackedIndices = new Set<string>()
  if (aliasJson && typeof aliasJson === 'object') {
    for (const [indexName, entry] of Object.entries(aliasJson)) {
      if (entry?.aliases && typeof entry.aliases === 'object' && Object.keys(entry.aliases).length > 0) {
        aliasBackedIndices.add(indexName)
      }
    }
  }

  const rawIndices = safe(() => parseIndices(files, aliasBackedIndices), [])

  // Join ILM policy names onto each index
  const indexPolicyMap = safe(() => buildIndexPolicyMap(files), new Map<string, string>())
  // Join model names onto each index
  const indexModelMap = safe(() => buildIndexModelMap(files), new Map<string, string[]>())

  // Per-index mode / synthetic source / vector / data_stream.type from settings.json + mapping.json
  const traitsByIndex = safe(() => parseIndexTraits(files), new Map<string, IndexTraits>())

  const indices = rawIndices.map((idx) => {
    const policy = indexPolicyMap.get(idx.name)
    const models = indexModelMap.get(idx.name)
    const traits = traitsByIndex.get(idx.name)
    return {
      ...idx,
      ilmPolicy: policy ?? null,
      models: models ?? [],
      ...(traits && {
        indexMode: traits.indexMode,
        syntheticSource: traits.syntheticSource,
        vector: traits.vector ?? null,
      }),
    }
  })

  // Parse features and aiMl separately so we can merge semantic/vector counts
  const features = safe(() => parseFeatures(files, indices), null)
  const aiMlBase = safe(() => parseML(files, indices), null)
  const aiMl = aiMlBase ? {
    ...aiMlBase,
    semanticTextIndexCount: features?.semanticTextIndexCount ?? 0,
    denseVectorIndexCount: features?.denseVectorIndexCount ?? 0,
    sparseVectorIndexCount: features?.sparseVectorIndexCount ?? 0,
  } : null

  const nodes = safe(() => parseNodes(files), [])
  const rawShards = safe(() => parseShards(files), [])

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
  const cacheStatsJson = parseJsonFile<CacheStatsJson>(files, 'commercial/searchable_snapshots_cache_stats.json')
  const sharedCacheByNodeId = new Map<string, number>()
  if (cacheStatsJson?.nodes && typeof cacheStatsJson.nodes === 'object') {
    for (const [id, nodeStats] of Object.entries(cacheStatsJson.nodes)) {
      const size = nodeStats?.shared_cache?.size_in_bytes
      if (typeof size === 'number') sharedCacheByNodeId.set(id, size)
    }
  }

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
    health: safe(() => parseHealth(files), null),
    internalHealth: safe(() => parseInternalHealth(files), null),
    auth: safe(() => parseAuth(files), null),
    nodes: nodesWithShardCounts,
    indices,
    shards,
    stats: safe(() => parseStats(files), null),
    ilm: safe(() => parseILM(files), null),
    aiMl,
    features,
    replication: safe(() => parseReplication(files), null),
    snapshots: safe(() => parseSnapshots(files, collectionDateMs), null),
    sizing: safe(() => parseSizing(files, indices), null),
    license: safe(() => parseLicense(files), null),
    plugins: safe(() => parsePlugins(files), []),
    dataStreams: safe(() => parseDataStreams(files), []),
    ingestPipelines: safe(() => parsePipelines(files), []),
    clusterSettings: safe(() => parseClusterSettings(files), null),
    tierStorage,
    nodeHealthSignals: safe(() => buildNodeHealthSignals(files, nodesWithShardCounts), []),
    pendingTasks: safe(() => parsePendingTasks(files), null),
    dataAdoption: safe(() => buildDataAdoption(indices, traitsByIndex), null),
  }
}

export type { BundleModel } from './types'
