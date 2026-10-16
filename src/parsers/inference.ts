import { parseJsonFile } from '../utils/bundleReader'
import type { InferenceEndpoint, InferenceInventory } from './types'

// Services that run on this cluster's own ML nodes; not an external provider.
const LOCAL_SERVICES = new Set(['elasticsearch', 'elser'])

interface ClusterStateJson {
  metadata?: { model_registry?: { models?: Record<string, unknown> } }
}

/**
 * Inference endpoints from cluster_state.json → metadata.model_registry.models.
 * Preconfigured Elastic-hosted endpoints have ids starting with "." and are only counted.
 * cluster_state.json can exceed 100 MB: it is parsed once here and never baked into the report.
 * Only id, service and task type are kept, so endpoint settings are never carried over.
 */
export function parseInferenceEndpoints(
  files: Map<string, string>,
  activeIds: readonly string[]
): InferenceInventory | null {
  const models = parseJsonFile<ClusterStateJson>(files, 'cluster_state.json')?.metadata?.model_registry?.models
  if (!models || typeof models !== 'object') return null

  const active = new Set(activeIds)
  const endpoints: InferenceEndpoint[] = []
  let builtInCount = 0

  for (const [id, raw] of Object.entries(models)) {
    if (id.startsWith('.')) {
      builtInCount++
      continue
    }
    const model = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    const service = typeof model.service === 'string' ? model.service : ''
    if (LOCAL_SERVICES.has(service)) continue
    endpoints.push({
      id,
      service,
      taskType: typeof model.task_type === 'string' ? model.task_type : '',
      inUse: active.has(id),
    })
  }

  if (endpoints.length === 0 && builtInCount === 0) return null
  return { endpoints: endpoints.sort((a, b) => a.id.localeCompare(b.id)), builtInCount }
}
