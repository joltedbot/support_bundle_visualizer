import { parseJsonFile } from '../utils/bundleReader'
import type { ReplicationInfo, ReplicationIndex, RemoteCluster, AutoFollowPattern } from './types'

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

interface IndicesStatsJson {
  indices?: Record<string, {
    shards?: Record<string, Array<{
      retention_leases?: {
        leases?: Array<{
          id: string
          source: string
        }>
      }
    }>>
  }>
}

/**
 * Parse commercial/ccr_stats.json + remote_cluster_info.json + commercial/ccr_follower_info.json
 * + commercial/ccr_autofollow_patterns.json + indices_stats.json → ReplicationInfo.
 * Returns null if all CCR/remote-cluster files are missing.
 */
export function parseReplication(files: Map<string, string>): ReplicationInfo | null {
  const ccrStats = parseJsonFile<CCRStatsJson>(files, 'commercial/ccr_stats.json')
  const remoteClusterInfo = parseJsonFile<Record<string, RemoteClusterJson>>(files, 'remote_cluster_info.json')
  const ccrFollowerInfo = parseJsonFile<CCRFollowerInfoJson>(files, 'commercial/ccr_follower_info.json')
  const ccrAutoFollowPatterns = parseJsonFile<CCRAutoFollowPatternsJson>(files, 'commercial/ccr_autofollow_patterns.json')
  const indicesStats = parseJsonFile<IndicesStatsJson>(files, 'indices_stats.json')

  if (!ccrStats && !remoteClusterInfo && !ccrFollowerInfo && !ccrAutoFollowPatterns) return null

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

  // Follower indices: indices on this cluster that follow remote leaders
  const followerReplicationIndices: ReplicationIndex[] = []
  if (ccrFollowerInfo?.follower_indices) {
    for (const f of ccrFollowerInfo.follower_indices) {
      followerReplicationIndices.push({
        localIndex: f.follower_index || '',
        remoteIndex: f.leader_index || '',
        remoteCluster: f.remote_cluster || '',
        role: 'Follower',
        status: f.status || null,
      })
    }
  }

  // Leader indices: indices on this cluster that remote clusters are following.
  // Detected via CCR retention leases (source: "ccr") in indices_stats.json.
  // Lease ID format: "{remote_cluster}/{remote_follower_index}/{remote_shard_id}-following-{local_cluster}/{local_index}/{local_shard_id}"
  const leaderReplicationIndices: ReplicationIndex[] = []
  const seenLeaderIndices = new Set<string>()

  if (indicesStats?.indices) {
    for (const [indexName, indexData] of Object.entries(indicesStats.indices)) {
      if (seenLeaderIndices.has(indexName)) continue
      const shards = indexData.shards ?? {}
      let found = false
      for (const shardCopies of Object.values(shards)) {
        if (found) break
        for (const shard of shardCopies) {
          if (found) break
          for (const lease of shard.retention_leases?.leases ?? []) {
            if (lease.source !== 'ccr') continue
            // Split on "-following-" to isolate the remote-side prefix
            const sepIdx = lease.id.indexOf('-following-')
            if (sepIdx === -1) continue
            const remotePart = lease.id.substring(0, sepIdx)
            const firstSlash = remotePart.indexOf('/')
            if (firstSlash === -1) continue
            const remoteCluster = remotePart.substring(0, firstSlash)
            const afterCluster = remotePart.substring(firstSlash + 1)
            const lastSlash = afterCluster.lastIndexOf('/')
            const remoteIndex = lastSlash === -1 ? afterCluster : afterCluster.substring(0, lastSlash)

            leaderReplicationIndices.push({
              localIndex: indexName,
              remoteIndex,
              remoteCluster,
              role: 'Leader',
              status: null,
            })
            seenLeaderIndices.add(indexName)
            found = true
            break
          }
        }
      }
    }
  }

  const followerIndexCount = followerReplicationIndices.length
  const leaderIndexCount = leaderReplicationIndices.length
  const hasCCR = followerIndexCount > 0 || leaderIndexCount > 0

  const replicationIndices: ReplicationIndex[] = [
    ...followerReplicationIndices,
    ...leaderReplicationIndices,
  ]

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
    leaderIndexCount,
    remoteClusterCount,
    remoteClusterNames,
    remoteClusters,
    replicationIndices,
    autoFollowPatterns,
  }
}
