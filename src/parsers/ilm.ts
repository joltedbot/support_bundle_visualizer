import { parseJsonFile } from '../utils/bundleReader'
import type { ILMInfo, ILMPolicyDetail } from './types'

interface ILMExplainIndex {
  managed?: boolean
  policy?: string
  phase?: string
}

interface ILMExplainJson {
  indices?: Record<string, ILMExplainIndex>
}

interface ILMPhaseActions {
  rollover?: { max_age?: string; max_primary_shard_size?: string; max_size?: string; max_docs?: number }
  forcemerge?: { max_num_segments?: number }
  shrink?: { number_of_shards?: number }
  delete?: unknown
}

interface ILMPhase {
  min_age?: string
  actions?: ILMPhaseActions
}

interface ILMPolicyEntry {
  policy?: {
    phases?: {
      hot?: ILMPhase
      warm?: ILMPhase
      cold?: ILMPhase
      delete?: ILMPhase
    }
  }
}

/**
 * Convert an ILM min_age string (e.g. "30d", "180d", "6M", "24h") to days.
 * Returns null for unparseable or zero/ms values.
 */
function parseMinAgeDays(minAge: string): number | null {
  if (!minAge) return null
  const lower = minAge.trim().toLowerCase()
  if (lower === '0ms' || lower === '0s' || lower === '0') return null
  const match = lower.match(/^(\d+(?:\.\d+)?)\s*([a-z]+)$/)
  if (!match) return null
  const value = parseFloat(match[1])
  const unit = match[2]
  if (isNaN(value) || value <= 0) return null
  switch (unit) {
    case 'd': return value
    case 'h': return value / 24
    case 'm': return value / 1440
    case 'M': return value * 30  // approximate
    case 'y': return value * 365
    default: return null
  }
}

/**
 * Build a map of index name → ILM policy name from ilm_explain.json.
 * Used by the orchestrator to join policy names onto IndexInfo.
 */
export function buildIndexPolicyMap(files: Map<string, string>): Map<string, string> {
  const explainRaw = parseJsonFile<ILMExplainJson>(files, 'commercial/ilm_explain.json')
  const map = new Map<string, string>()
  if (!explainRaw) return map

  const indices: Record<string, ILMExplainIndex> =
    explainRaw?.indices ?? (explainRaw as Record<string, ILMExplainIndex>)

  for (const [indexName, entry] of Object.entries(indices)) {
    if (entry?.managed && entry.policy) {
      map.set(indexName, entry.policy)
    }
  }
  return map
}

/**
 * Parse commercial/ilm_policies.json + commercial/ilm_explain.json → ILMInfo.
 * Returns null if both files are missing.
 */
export function parseILM(files: Map<string, string>): ILMInfo | null {
  const policiesRaw = parseJsonFile<Record<string, ILMPolicyEntry>>(files, 'commercial/ilm_policies.json')
  const explainRaw = parseJsonFile<ILMExplainJson>(files, 'commercial/ilm_explain.json')

  if (!policiesRaw && !explainRaw) return null

  const policyCount = policiesRaw ? Object.keys(policiesRaw).length : 0

  // ilm_explain may wrap indices under an "indices" key or be keyed directly
  const indices: Record<string, ILMExplainIndex> =
    explainRaw?.indices ?? ((explainRaw as Record<string, ILMExplainIndex> | null) ?? {})

  let managedIndexCount = 0
  const tiers = { hot: 0, warm: 0, cold: 0, frozen: 0 }

  // Count indices per policy
  const indexCountByPolicy = new Map<string, number>()

  for (const entry of Object.values(indices)) {
    if (!entry || typeof entry !== 'object') continue
    if (entry.managed) {
      managedIndexCount++
      const phase = entry.phase
      if (phase === 'hot') tiers.hot++
      else if (phase === 'warm') tiers.warm++
      else if (phase === 'cold') tiers.cold++
      else if (phase === 'frozen') tiers.frozen++

      if (entry.policy) {
        indexCountByPolicy.set(entry.policy, (indexCountByPolicy.get(entry.policy) ?? 0) + 1)
      }
    }
  }

  // Parse policy details
  const policies: ILMPolicyDetail[] = []

  if (policiesRaw) {
    for (const [name, entry] of Object.entries(policiesRaw)) {
      const phases = entry?.policy?.phases ?? {}

      const hot = phases.hot
      const warm = phases.warm
      const cold = phases.cold
      const del = phases.delete

      const hotRollover = hot?.actions?.rollover
      const hotMaxAge = hotRollover?.max_age ?? null
      const hotMaxSize = hotRollover?.max_primary_shard_size ?? hotRollover?.max_size ?? null

      const warmMinAge = warm?.min_age ? (parseMinAgeDays(warm.min_age) !== null ? warm.min_age : null) : null
      const coldMinAge = cold?.min_age ? (parseMinAgeDays(cold.min_age) !== null ? cold.min_age : null) : null

      const deleteMinAge = del?.min_age ?? null
      const deleteDays = deleteMinAge ? (parseMinAgeDays(deleteMinAge) ?? null) : null

      // forcemerge can be in hot or warm
      const fmSegments =
        warm?.actions?.forcemerge?.max_num_segments ??
        hot?.actions?.forcemerge?.max_num_segments ??
        null

      // shrink can be in warm
      const shrinkShards = warm?.actions?.shrink?.number_of_shards ?? null

      policies.push({
        name,
        deleteDays,
        hotMaxAge,
        hotMaxSize,
        warmMinAge,
        coldMinAge,
        forceMergeSegments: fmSegments ?? null,
        shrinkShards: shrinkShards ?? null,
        indexCount: indexCountByPolicy.get(name) ?? 0,
      })
    }
  }

  // Sort: policies with managed indices first (desc by count), then alphabetically
  policies.sort((a, b) => {
    if (b.indexCount !== a.indexCount) return b.indexCount - a.indexCount
    return a.name.localeCompare(b.name)
  })

  return { policyCount, managedIndexCount, tiers, policies }
}
