import { parseJsonFile } from '../utils/bundleReader'
import type { PipelineInfo } from './types'

interface PipelineJson {
  description?: string
  created_date?: string
  _meta?: {
    package?: { name?: string }
    managed?: boolean
    managed_by?: string
  }
}

export function parsePipelines(files: Map<string, string>): PipelineInfo[] {
  const json = parseJsonFile<Record<string, PipelineJson>>(files, 'pipelines.json')
  if (!json || typeof json !== 'object') return []

  return Object.entries(json).map(([name, data]) => ({
    name,
    description: data.description,
    createdDate: data.created_date,
    metaPackageName: data._meta?.package?.name,
    metaManaged: data._meta?.managed,
    metaManagedBy: data._meta?.managed_by,
  }))
}
