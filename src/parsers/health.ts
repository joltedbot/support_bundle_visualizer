import { parseJsonFile } from '../utils/bundleReader'
import type { ClusterHealth } from './types'

interface ClusterHealthResponse {
  status?: string
  number_of_nodes?: number
  number_of_data_nodes?: number
  active_primary_shards?: number
  active_shards?: number
  relocating_shards?: number
  initializing_shards?: number
  unassigned_shards?: number
  active_shards_percent_as_number?: number
}

function normalizeStatus(status: string | undefined): ClusterHealth['status'] {
  if (status === 'green') return 'green'
  if (status === 'yellow') return 'yellow'
  if (status === 'red') return 'red'
  return 'unknown'
}

/**
 * Parse cluster health from cluster_health.json.
 * Returns null if file is missing or malformed.
 */
export function parseHealth(files: Map<string, string>): ClusterHealth | null {
  const raw = parseJsonFile<ClusterHealthResponse>(files, 'cluster_health.json')
  if (!raw) return null

  return {
    status: normalizeStatus(raw.status),
    numberOfNodes: raw.number_of_nodes ?? 0,
    numberOfDataNodes: raw.number_of_data_nodes ?? 0,
    activePrimaryShards: raw.active_primary_shards ?? 0,
    activeShards: raw.active_shards ?? 0,
    relocatingShards: raw.relocating_shards ?? 0,
    initializingShards: raw.initializing_shards ?? 0,
    unassignedShards: raw.unassigned_shards ?? 0,
    activeShardsPercent: raw.active_shards_percent_as_number ?? 0,
  }
}
