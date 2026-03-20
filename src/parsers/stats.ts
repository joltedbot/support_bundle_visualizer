import { parseJsonFile } from '../utils/bundleReader'
import type { ClusterStats } from './types'

interface ClusterStatsJson {
  indices?: {
    store?: { size_in_bytes?: number }
    docs?: { count?: number }
    search?: { total?: number }
    fielddata?: { memory_size_in_bytes?: number }
    segments?: { count?: number }
  }
}

/**
 * Parse cluster_stats.json → ClusterStats.
 * Returns null if file is missing or malformed.
 */
export function parseStats(files: Map<string, string>): ClusterStats | null {
  const raw = parseJsonFile<ClusterStatsJson>(files, 'cluster_stats.json')
  if (!raw?.indices) return null

  const idx = raw.indices
  const totalStoreSizeBytes = idx.store?.size_in_bytes ?? 0
  const totalDocCount = idx.docs?.count ?? 0
  const avgDocSizeBytes = totalDocCount > 0 ? Math.round(totalStoreSizeBytes / totalDocCount) : 0

  return {
    totalStoreSizeBytes,
    totalDocCount,
    avgDocSizeBytes,
    searchQueryTotal: idx.search?.total ?? 0,
    fieldDataSizeBytes: idx.fielddata?.memory_size_in_bytes ?? 0,
    segmentCount: idx.segments?.count ?? 0,
  }
}
