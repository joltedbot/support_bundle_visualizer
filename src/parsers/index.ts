import type { BundleData } from '../utils/bundleReader'
import type { BundleModel } from './types'
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

export async function parseBundle(data: BundleData): Promise<BundleModel> {
  const { files } = data
  const rawIndices = parseIndices(files)

  // Join ILM policy names onto each index
  const indexPolicyMap = buildIndexPolicyMap(files)
  // Join model names onto each index
  const indexModelMap = buildIndexModelMap(files)

  const indices = rawIndices.map((idx) => {
    const policy = indexPolicyMap.get(idx.name)
    const models = indexModelMap.get(idx.name)
    let updated = idx
    if (policy) updated = { ...updated, ilmPolicy: policy }
    if (models) updated = { ...updated, models }
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
  const shards = parseShards(files)

  // Compute shard counts per node
  const shardCountsByNode = new Map<string, number>()
  for (const shard of shards) {
    if (shard.node) {
      shardCountsByNode.set(shard.node, (shardCountsByNode.get(shard.node) ?? 0) + 1)
    }
  }
  const nodesWithShardCounts = nodes.map((node) => {
    const count = shardCountsByNode.get(node.name)
    return count !== undefined ? { ...node, shardCount: count } : node
  })

  // Compute tier storage via shard-to-node join
  const nodeTierMap = new Map<string, string>()
  for (const node of nodes) {
    nodeTierMap.set(node.name, node.tier)
  }
  const tierStorageMap: Record<string, number> = {}
  for (const shard of shards) {
    if (shard.node) {
      const tier = nodeTierMap.get(shard.node)
      if (tier) {
        tierStorageMap[tier] = (tierStorageMap[tier] ?? 0) + shard.storeSizeBytes
      }
    }
  }

  // Fallback: for tiers where shard store reports 0 (e.g. frozen/searchable snapshots),
  // use node-level disk usage (diskTotal - diskAvail) as an approximation
  const tiersByNode = new Map<string, string>()
  for (const node of nodes) {
    tiersByNode.set(node.name, node.tier)
  }
  const nodeDiskByTier: Record<string, number> = {}
  for (const node of nodes) {
    if (node.diskTotal != null && node.diskAvail != null) {
      const used = node.diskTotal - node.diskAvail
      if (used > 0) {
        nodeDiskByTier[node.tier] = (nodeDiskByTier[node.tier] ?? 0) + used
      }
    }
  }
  // Apply node-disk fallback only for tiers with zero shard-based storage
  for (const [tier, diskUsed] of Object.entries(nodeDiskByTier)) {
    if (!tierStorageMap[tier] || tierStorageMap[tier] === 0) {
      tierStorageMap[tier] = diskUsed
    }
  }

  const tierStorage = Object.keys(tierStorageMap).length > 0 ? tierStorageMap : null

  return {
    identity: parseManifest(files),
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
