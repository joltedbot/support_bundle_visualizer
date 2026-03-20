import { parseJsonFile } from '../utils/bundleReader'
import type { ReplicationInfo } from './types'

interface CCRStatsJson {
  follow_stats?: {
    indices?: unknown[]
  }
}

/**
 * Parse commercial/ccr_stats.json + remote_cluster_info.json → ReplicationInfo.
 * Returns null if both files are missing.
 */
export function parseReplication(files: Map<string, string>): ReplicationInfo | null {
  const ccrStats = parseJsonFile<CCRStatsJson>(files, 'commercial/ccr_stats.json')
  const remoteClusterInfo = parseJsonFile<Record<string, unknown>>(files, 'remote_cluster_info.json')

  if (!ccrStats && !remoteClusterInfo) return null

  const followerIndices = ccrStats?.follow_stats?.indices ?? []
  const followerIndexCount = Array.isArray(followerIndices) ? followerIndices.length : 0
  const hasCCR = followerIndexCount > 0

  const remoteClusterNames = remoteClusterInfo ? Object.keys(remoteClusterInfo) : []
  const remoteClusterCount = remoteClusterNames.length

  return {
    hasCCR,
    followerIndexCount,
    remoteClusterCount,
    remoteClusterNames,
  }
}
