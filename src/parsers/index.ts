import type { BundleData } from '../utils/bundleReader'
import { parseJsonFile } from '../utils/bundleReader'
import type { BundleModel, IndexInfo, NodeInfo } from './types'
import type { ShardInfo } from './shards'
import { parseManifest } from './manifest'
import { parseHealth } from './health'
import { parseInternalHealth } from './internalHealth'
import { parseAuth } from './auth'
import { parseNodes } from './nodes'
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

function joinIlmAndModels(
  rawIndices: IndexInfo[],
  policyMap: Map<string, string>,
  modelMap: Map<string, string[]>
): IndexInfo[] {
  return rawIndices.map((idx) => {
    const policy = policyMap.get(idx.name)
    const models = modelMap.get(idx.name)
    let updated = idx
    if (policy) updated = { ...updated, ilmPolicy: policy }
    if (models) updated = { ...updated, models }
    return updated
  })
}

interface ShardAggregation {
  nodesWithShardCounts: NodeInfo[]
  tierStorage: Record<string, number> | null
  flaggedIndices: string[]
}

function aggregateShards(nodes: NodeInfo[], shards: ShardInfo[]): ShardAggregation {
  // Build tier lookup for node name → tier
  const nodeTierMap = new Map<string, string>()
  for (const node of nodes) {
    nodeTierMap.set(node.name, node.tier)
  }

  // Single pass: shard counts per node, tier storage totals, flagged indices
  const shardCountsByNode = new Map<string, number>()
  const tierStorageMap: Record<string, number> = {}
  const flaggedIndicesSet = new Set<string>()

  for (const shard of shards) {
    if (shard.node) {
      shardCountsByNode.set(shard.node, (shardCountsByNode.get(shard.node) ?? 0) + 1)
      const tier = nodeTierMap.get(shard.node)
      if (tier) {
        tierStorageMap[tier] = (tierStorageMap[tier] ?? 0) + shard.storeSizeBytes
      }
    }
    if (shard.oversized || shard.undersized) {
      flaggedIndicesSet.add(shard.index)
    }
  }

  // Fallback: for tiers where shard store reports 0 (e.g. frozen/searchable snapshots),
  // use node-level disk usage (diskTotal - diskAvail) as an approximation
  const nodeDiskByTier: Record<string, number> = {}
  for (const node of nodes) {
    if (node.diskTotal != null && node.diskAvail != null) {
      const used = node.diskTotal - node.diskAvail
      if (used > 0) {
        nodeDiskByTier[node.tier] = (nodeDiskByTier[node.tier] ?? 0) + used
      }
    }
  }
  for (const [tier, diskUsed] of Object.entries(nodeDiskByTier)) {
    if (!tierStorageMap[tier] || tierStorageMap[tier] === 0) {
      tierStorageMap[tier] = diskUsed
    }
  }

  const nodesWithShardCounts = nodes.map((node) => {
    const count = shardCountsByNode.get(node.name)
    return count !== undefined ? { ...node, shardCount: count } : node
  })

  return {
    nodesWithShardCounts,
    tierStorage: Object.keys(tierStorageMap).length > 0 ? tierStorageMap : null,
    flaggedIndices: Array.from(flaggedIndicesSet),
  }
}

export async function parseBundle(data: BundleData): Promise<BundleModel> {
  const { files } = data

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
  const indices = joinIlmAndModels(rawIndices, buildIndexPolicyMap(files), buildIndexModelMap(files))

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
  const { nodesWithShardCounts, tierStorage, flaggedIndices } = aggregateShards(nodes, parseShards(files))

  return {
    identity: parseManifest(files),
    health: parseHealth(files),
    internalHealth: parseInternalHealth(files),
    auth: parseAuth(files),
    nodes: nodesWithShardCounts,
    indices,
    flaggedIndices,
    stats: parseStats(files),
    ilm: parseILM(files),
    aiMl,
    features,
    replication: parseReplication(files),
    snapshots: parseSnapshots(files),
    sizing: parseSizing(files, indices),
    license: parseLicense(files),
    plugins: parsePlugins(files),
    dataStreams: parseDataStreams(files),
    ingestPipelines: parsePipelines(files),
    clusterSettings: parseClusterSettings(files),
    tierStorage,
  }
}

export type { BundleModel } from './types'
