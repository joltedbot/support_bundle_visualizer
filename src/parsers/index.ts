import type { BundleData } from '../utils/bundleReader'
import type { BundleModel } from './types'
import { parseManifest } from './manifest'
import { parseHealth } from './health'
import { parseNodes } from './nodes'
import { parseIndices } from './indices'
import { parseShards } from './shards'
import { parseStats } from './stats'
import { parseILM } from './ilm'
import { parseML } from './ml'
import { parseFeatures } from './features'
import { parseReplication } from './replication'
import { parseSnapshots } from './snapshots'
import { parseSizing } from './sizing'

export async function parseBundle(data: BundleData): Promise<BundleModel> {
  const { files } = data
  const indices = parseIndices(files)
  return {
    identity: parseManifest(files),
    health: parseHealth(files),
    nodes: parseNodes(files),
    indices,
    shards: parseShards(files),
    stats: parseStats(files),
    ilm: parseILM(files),
    ml: parseML(files),
    features: parseFeatures(files, indices),
    replication: parseReplication(files),
    snapshots: parseSnapshots(files),
    sizing: parseSizing(files, indices),
  }
}

export type { BundleModel } from './types'
