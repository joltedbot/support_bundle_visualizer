import { parseJsonFile } from '../utils/bundleReader'
import { walkMappingFields, buildPipelineLookups } from './mappingScan'
import type { MappingField } from './mappingScan'

type MappingIndex = {
  mappings?: {
    properties?: Record<string, MappingField>
  }
}

/**
 * Builds a map of index name to unique model/inference IDs used.
 * Sources:
 * 1. inference processors in default_pipeline or final_pipeline.
 * 2. field-level inference_id in mappings (or an external dense_vector, labelled by dims).
 */
export function buildIndexModelMap(files: Map<string, string>): Map<string, string[]> {
  const indexModelMap = new Map<string, Set<string>>()
  const modelsFor = (indexName: string): Set<string> => {
    let models = indexModelMap.get(indexName)
    if (!models) {
      models = new Set()
      indexModelMap.set(indexName, models)
    }
    return models
  }

  // 1. Index → pipeline → model
  const { indexToPipeline, pipelineToModelId } = buildPipelineLookups(files)
  for (const [indexName, pipelineName] of indexToPipeline) {
    const modelId = pipelineToModelId.get(pipelineName)
    if (modelId) modelsFor(indexName).add(modelId)
  }

  // 2. Scan index mappings for inference_id
  const mappingRaw = parseJsonFile<Record<string, MappingIndex>>(files, 'mapping.json')
  if (mappingRaw && typeof mappingRaw === 'object') {
    for (const [indexName, indexMapping] of Object.entries(mappingRaw)) {
      if (!indexMapping?.mappings?.properties) continue
      const models = modelsFor(indexName)
      walkMappingFields(indexMapping.mappings.properties, field => {
        if (field.inference_id) {
          models.add(field.inference_id)
        } else if (field.type === 'dense_vector' && field.dims) {
          models.add(`External - Dense - ${field.dims}dims`)
        }
      })
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
