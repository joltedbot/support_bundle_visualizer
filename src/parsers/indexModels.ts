import { parseJsonFile } from '../utils/bundleReader'

type MappingValue = {
  type?: string
  dims?: number
  inference_id?: string
  properties?: Record<string, MappingValue>
  fields?: Record<string, MappingValue>
}

type MappingIndex = {
  mappings?: {
    properties?: Record<string, MappingValue>
  }
}

type SettingsIndex = {
  settings?: { index?: { default_pipeline?: string; final_pipeline?: string } }
}

type InferenceProcessor = {
  model_id?: string
  inference_id?: string
}

type PipelineProcessor = { inference?: InferenceProcessor }

type Pipeline = { processors?: PipelineProcessor[] }

/**
 * Recursively scan mapping properties for inference_id.
 */
function scanMappingsForModels(
  props: Record<string, MappingValue>,
  models: Set<string>,
  depth = 0
) {
  if (depth > 10) return

  for (const field of Object.values(props)) {
    if (!field || typeof field !== 'object') continue
    if (field.inference_id) {
      models.add(field.inference_id)
    }

    if (field.properties) {
      scanMappingsForModels(field.properties, models, depth + 1)
    }
    if (field.fields) {
      scanMappingsForModels(field.fields, models, depth + 1)
    }
  }
}

/**
 * Builds a map of index name to unique model/inference IDs used.
 * Sources:
 * 1. field-level inference_id in mappings.
 * 2. inference processors in default_pipeline or final_pipeline.
 */
export function buildIndexModelMap(files: Map<string, string>): Map<string, string[]> {
  const indexModelMap = new Map<string, Set<string>>()

  // 1. Build pipeline -> model_id lookup
  const pipelineToModelId = new Map<string, string>()
  const pipelines = parseJsonFile<Record<string, Pipeline>>(files, 'pipelines.json')
  if (pipelines && typeof pipelines === 'object') {
    for (const [pipelineName, pipeline] of Object.entries(pipelines)) {
      for (const proc of pipeline?.processors ?? []) {
        const inf = proc?.inference
        if (inf) {
          const modelId = inf.model_id ?? inf.inference_id
          if (modelId) {
            pipelineToModelId.set(pipelineName, modelId)
            break // Take the first inference processor for now
          }
        }
      }
    }
  }

  // 2. Scan index settings for pipelines
  const settingsRaw = parseJsonFile<Record<string, SettingsIndex>>(files, 'settings.json')
  if (settingsRaw && typeof settingsRaw === 'object') {
    for (const [indexName, indexSettings] of Object.entries(settingsRaw)) {
      const idxBlock = indexSettings?.settings?.index
      const pipelineName = idxBlock?.default_pipeline ?? idxBlock?.final_pipeline
      if (pipelineName) {
        const modelId = pipelineToModelId.get(pipelineName)
        if (modelId) {
          if (!indexModelMap.has(indexName)) indexModelMap.set(indexName, new Set())
          indexModelMap.get(indexName)!.add(modelId)
        }
      }
    }
  }

  // 3. Scan index mappings for inference_id
  const mappingRaw = parseJsonFile<Record<string, MappingIndex>>(files, 'mapping.json')
  if (mappingRaw && typeof mappingRaw === 'object') {
    for (const [indexName, indexMapping] of Object.entries(mappingRaw)) {
      if (!indexMapping?.mappings?.properties) continue
      if (!indexModelMap.has(indexName)) indexModelMap.set(indexName, new Set())
      const models = indexModelMap.get(indexName)!
      scanMappingsForModels(indexMapping.mappings.properties, models)
    }
  }

  // Convert Sets to sorted arrays
  const result = new Map<string, string[]>()
  for (const [indexName, models] of indexModelMap.entries()) {
    if (models.size > 0) {
      result.set(indexName, Array.from(models).sort())
    }
  }

  return result
}
