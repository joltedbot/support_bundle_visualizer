import { parseJsonFile } from '../utils/bundleReader'
import { parseMinAgeDays } from '../utils/parseMinAgeDays'
import type { ILMInfo, ILMPolicyDetail } from './types'
import type { ILMPolicyEntry } from './rawTypes'

export { parseMinAgeDays }

interface ILMExplainIndex {
  managed?: boolean
  policy?: string
  phase?: string
}

interface ILMExplainJson {
  indices?: Record<string, ILMExplainIndex>
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
      const frozen = phases.frozen
      const del = phases.delete

      const hotRollover = hot?.actions?.rollover
      const hotMaxAge = hotRollover?.max_age ?? null
      const hotMaxSize = hotRollover?.max_primary_shard_size ?? hotRollover?.max_size ?? null

      const warmMinAge = warm?.min_age ? (parseMinAgeDays(warm.min_age) !== null ? warm.min_age : null) : null
      const coldMinAge = cold?.min_age ? (parseMinAgeDays(cold.min_age) !== null ? cold.min_age : null) : null
      const frozenMinAge = frozen?.min_age ? (parseMinAgeDays(frozen.min_age) !== null ? frozen.min_age : null) : null

      const rawDeleteMinAge = del?.min_age ?? null
      const deleteDays = rawDeleteMinAge ? (parseMinAgeDays(rawDeleteMinAge) ?? null) : null

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
        frozenMinAge,
        deleteMinAge: rawDeleteMinAge,
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
