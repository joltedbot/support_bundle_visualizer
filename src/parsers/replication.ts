import { parseJsonFile } from '../utils/bundleReader'
import type { ReplicationInfo, RemoteCluster, FollowerIndex, AutoFollowPattern } from './types'

interface CCRStatsJson {
  follow_stats?: {
    indices?: unknown[]
  }
}

interface RemoteClusterJson {
  connected?: boolean
  mode?: string
  proxy_address?: string
  skip_unavailable?: boolean
  num_proxy_sockets_connected?: number
  max_proxy_socket_connections?: number
}

interface CCRFollowerInfoJson {
  follower_indices?: Array<{
    follower_index?: string
    remote_cluster?: string
    leader_index?: string
    status?: string
  }>
}

interface CCRAutoFollowPatternsJson {
  patterns?: Array<{
    name?: string
    remote_cluster?: string
    leader_index_patterns?: string[]
    follow_index_pattern?: string
  }>
}

/**
 * Parse commercial/ccr_stats.json + remote_cluster_info.json + commercial/ccr_follower_info.json + commercial/ccr_autofollow_patterns.json → ReplicationInfo.
 * Returns null if all files are missing.
 */
export function parseReplication(files: Map<string, string>): ReplicationInfo | null {
  const ccrStats = parseJsonFile<CCRStatsJson>(files, 'commercial/ccr_stats.json')
  const remoteClusterInfo = parseJsonFile<Record<string, RemoteClusterJson>>(files, 'remote_cluster_info.json')
  const ccrFollowerInfo = parseJsonFile<CCRFollowerInfoJson>(files, 'commercial/ccr_follower_info.json')
  const ccrAutoFollowPatterns = parseJsonFile<CCRAutoFollowPatternsJson>(files, 'commercial/ccr_autofollow_patterns.json')

  if (!ccrStats && !remoteClusterInfo && !ccrFollowerInfo && !ccrAutoFollowPatterns) return null

  const followerIndicesStats = ccrStats?.follow_stats?.indices ?? []
  const followerIndexCount = Array.isArray(followerIndicesStats) ? followerIndicesStats.length : 0
  const hasCCR = followerIndexCount > 0

  const remoteClusterNames = remoteClusterInfo ? Object.keys(remoteClusterInfo) : []
  const remoteClusterCount = remoteClusterNames.length

  const remoteClusters: RemoteCluster[] = []
  if (remoteClusterInfo) {
    for (const [name, info] of Object.entries(remoteClusterInfo)) {
      remoteClusters.push({
        name,
        connected: info.connected ?? false,
        mode: info.mode || 'sniff',
        proxyAddress: info.proxy_address || null,
        skipUnavailable: info.skip_unavailable ?? false,
        socketConnections: info.num_proxy_sockets_connected,
        maxSocketConnections: info.max_proxy_socket_connections,
      })
    }
  }

  const followerIndices: FollowerIndex[] = []
  if (ccrFollowerInfo?.follower_indices) {
    for (const f of ccrFollowerInfo.follower_indices) {
      followerIndices.push({
        followerIndex: f.follower_index || '',
        remoteCluster: f.remote_cluster || '',
        leaderIndex: f.leader_index || '',
        status: f.status || '',
      })
    }
  }

  const autoFollowPatterns: AutoFollowPattern[] = []
  if (ccrAutoFollowPatterns?.patterns) {
    for (const p of ccrAutoFollowPatterns.patterns) {
      autoFollowPatterns.push({
        name: p.name || '',
        remoteCluster: p.remote_cluster || '',
        leaderIndexPatterns: p.leader_index_patterns || [],
        followIndexPattern: p.follow_index_pattern || '',
      })
    }
  }

  return {
    hasCCR,
    followerIndexCount,
    remoteClusterCount,
    remoteClusterNames,
    remoteClusters,
    followerIndices,
    autoFollowPatterns,
  }
}
