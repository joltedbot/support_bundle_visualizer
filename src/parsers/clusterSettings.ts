import type { ClusterSettings } from './types'
import { parseJsonFile } from '../utils/bundleReader'

interface ClusterSettingsJson {
  persistent?: Record<string, unknown>
  transient?: Record<string, unknown>
}

/**
 * Parse cluster_settings.json to extract cluster-level shard limits.
 *
 * Checks both `persistent` and `transient` settings — transient wins
 * when both are present (matching Elasticsearch precedence).
 */
export function parseClusterSettings(
  files: Map<string, string>
): ClusterSettings | null {
  const raw = parseJsonFile<ClusterSettingsJson>(files, 'cluster_settings.json')
  if (!raw) return null

  const persistent = raw.persistent ?? {}
  const transient_ = raw.transient ?? {}

  // Extract cluster.max_shards_per_node from nested or flat key format
  const getNestedValue = (
    obj: Record<string, unknown>,
    ...paths: string[]
  ): string | null => {
    for (const path of paths) {
      // Try flat key first (e.g. "cluster.max_shards_per_node")
      const flat = (obj as Record<string, unknown>)[path]
      if (flat !== undefined && flat !== null) return String(flat)

      // Try nested path
      const parts = path.split('.')
      let current: unknown = obj
      for (const part of parts) {
        if (current == null || typeof current !== 'object') {
          current = undefined
          break
        }
        current = (current as Record<string, unknown>)[part]
      }
      if (current !== undefined && current !== null) return String(current)
    }
    return null
  }

  const persistentMax = getNestedValue(
    persistent,
    'cluster.max_shards_per_node'
  )
  const transientMax = getNestedValue(
    transient_,
    'cluster.max_shards_per_node'
  )
  const persistentFrozen = getNestedValue(
    persistent,
    'cluster.max_shards_per_node.frozen'
  )
  const transientFrozen = getNestedValue(
    transient_,
    'cluster.max_shards_per_node.frozen'
  )

  // Transient wins over persistent
  const maxStr = transientMax ?? persistentMax
  const frozenStr = transientFrozen ?? persistentFrozen

  const maxVal = maxStr ? parseInt(maxStr, 10) : null
  const frozenVal = frozenStr ? parseInt(frozenStr, 10) : null

  return {
    maxShardsPerNode: maxVal !== null && !isNaN(maxVal) ? maxVal : null,
    maxShardsPerNodeFrozen:
      frozenVal !== null && !isNaN(frozenVal) ? frozenVal : null,
  }
}
