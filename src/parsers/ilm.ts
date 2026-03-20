import { parseJsonFile } from '../utils/bundleReader'
import type { ILMInfo } from './types'

interface ILMExplainIndex {
  managed?: boolean
  phase?: string
}

interface ILMExplainJson {
  indices?: Record<string, ILMExplainIndex>
}

/**
 * Parse commercial/ilm_policies.json + commercial/ilm_explain.json → ILMInfo.
 * Returns null if both files are missing.
 */
export function parseILM(files: Map<string, string>): ILMInfo | null {
  const policiesRaw = parseJsonFile<Record<string, unknown>>(files, 'commercial/ilm_policies.json')
  const explainRaw = parseJsonFile<ILMExplainJson>(files, 'commercial/ilm_explain.json')

  if (!policiesRaw && !explainRaw) return null

  const policyCount = policiesRaw ? Object.keys(policiesRaw).length : 0

  // ilm_explain may wrap indices under an "indices" key or be keyed directly
  const indices: Record<string, ILMExplainIndex> = explainRaw?.indices ?? ((explainRaw as Record<string, ILMExplainIndex> | null) ?? {})

  let managedIndexCount = 0
  const tiers = { hot: 0, warm: 0, cold: 0, frozen: 0 }

  for (const entry of Object.values(indices)) {
    if (!entry || typeof entry !== 'object') continue
    if (entry.managed) {
      managedIndexCount++
      const phase = entry.phase
      if (phase === 'hot') tiers.hot++
      else if (phase === 'warm') tiers.warm++
      else if (phase === 'cold') tiers.cold++
      else if (phase === 'frozen') tiers.frozen++
    }
  }

  return { policyCount, managedIndexCount, tiers }
}
