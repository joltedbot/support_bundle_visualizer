import { parseJsonFile } from '../utils/bundleReader'
import type { InternalHealth, HealthIndicator } from './types'

interface InternalHealthJson {
  status?: string
  cluster_name?: string
  indicators?: Record<string, {
    status?: string
    symptom?: string
    details?: Record<string, unknown>
  }>
}

export function parseInternalHealth(files: Map<string, string>): InternalHealth | null {
  const data = parseJsonFile<InternalHealthJson>(files, 'internal_health.json')
  if (!data || !data.indicators) return null

  const indicators: Record<string, HealthIndicator> = {}
  
  for (const [key, val] of Object.entries(data.indicators)) {
    if (!val || typeof val !== 'object') continue
    const rawStatus = typeof val.status === 'string' ? val.status.toLowerCase() : ''
    const status: HealthIndicator['status'] =
      rawStatus === 'green' || rawStatus === 'yellow' || rawStatus === 'red' ? rawStatus : 'unknown'
    indicators[key] = {
      status,
      symptom: val.symptom || '',
      // The UI shows details only for non-green indicators; don't bake the rest into the HTML
      details: status === 'green' ? null : val.details || null
    }
  }

  return {
    overallStatus: data.status || 'unknown',
    indicators
  }
}
