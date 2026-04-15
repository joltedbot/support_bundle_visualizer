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
    indicators[key] = {
      status: (val.status?.toLowerCase() as HealthIndicator['status']) || 'unknown',
      symptom: val.symptom || '',
      details: val.details || null
    }
  }

  return {
    overallStatus: data.status || 'unknown',
    indicators
  }
}
