import type { BundleData } from '../utils/bundleReader'
import type { BundleModel } from './types'
import { parseManifest } from './manifest'
import { parseHealth } from './health'
import { parseNodes } from './nodes'
import { parseIndices } from './indices'
import { parseShards } from './shards'
import { parseStats } from './stats'
import { parseILM, buildIndexPolicyMap } from './ilm'
import { parseML } from './ml'
import { parseFeatures } from './features'
import { parseReplication } from './replication'
import { parseSnapshots } from './snapshots'
import { parseSizing } from './sizing'
import { parseLicense } from './license'
import { parsePlugins } from './plugins'
import { parseDataStreams } from './datastreams'

export async function parseBundle(data: BundleData): Promise<BundleModel> {
  const { files } = data
  const rawIndices = parseIndices(files)

  // Join ILM policy names onto each index
  const indexPolicyMap = buildIndexPolicyMap(files)
  const indices = rawIndices.map((idx) => {
    const policy = indexPolicyMap.get(idx.name)
    return policy ? { ...idx, ilmPolicy: policy } : idx
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

  return {
    identity: parseManifest(files),
    health: parseHealth(files),
    nodes: parseNodes(files),
    indices,
    shards: parseShards(files),
    stats: parseStats(files),
    aiMl,
    features,
    replication: parseReplication(files),
    snapshots: parseSnapshots(files),
    sizing: parseSizing(files, indices),
    license: parseLicense(files),
    plugins: parsePlugins(files),
    dataStreams: parseDataStreams(files),
  }
}

export type { BundleModel } from './types'
