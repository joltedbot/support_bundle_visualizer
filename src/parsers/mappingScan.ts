import { parseJsonFile } from '../utils/bundleReader'

// Shared building blocks for the parsers that read mapping.json / settings.json / pipelines.json
// (features, indexModels, indexTraits). Keep per-parser semantics in the visitors, not here.

export type MappingField = {
  type?: string
  value?: string
  dims?: number
  inference_id?: string
  index_options?: { type?: string }
  properties?: Record<string, MappingField>
  fields?: Record<string, MappingField>
}

export const MAPPING_MAX_DEPTH = 10

/**
 * Depth-first walk over a mapping `properties` tree (including multi-fields), calling `visit`
 * for every field object. Skips non-object entries and stops descending past MAPPING_MAX_DEPTH.
 */
export function walkMappingFields(
  props: Record<string, MappingField>,
  visit: (field: MappingField) => void,
  depth = 0
): void {
  if (depth > MAPPING_MAX_DEPTH) return
  for (const field of Object.values(props)) {
    if (!field || typeof field !== 'object') continue
    visit(field)
    if (field.properties) walkMappingFields(field.properties, visit, depth + 1)
    if (field.fields) walkMappingFields(field.fields, visit, depth + 1)
  }
}

type SettingsIndex = {
  settings?: { index?: { default_pipeline?: string; final_pipeline?: string } }
}

type Pipeline = {
  processors?: Array<{ inference?: { model_id?: string; inference_id?: string } } | null>
}

export interface PipelineLookups {
  /** index name → default (or final) ingest pipeline name, from settings.json */
  indexToPipeline: Map<string, string>
  /** pipeline name → model/inference id of its first inference processor, from pipelines.json */
  pipelineToModelId: Map<string, string>
  /** number of pipelines in pipelines.json */
  pipelineCount: number
}

export function buildPipelineLookups(files: Map<string, string>): PipelineLookups {
  const indexToPipeline = new Map<string, string>()
  const settingsRaw = parseJsonFile<Record<string, SettingsIndex>>(files, 'settings.json')
  if (settingsRaw && typeof settingsRaw === 'object') {
    for (const [indexName, indexSettings] of Object.entries(settingsRaw)) {
      const idxBlock = indexSettings?.settings?.index
      const pipeline = idxBlock?.default_pipeline ?? idxBlock?.final_pipeline
      if (pipeline) indexToPipeline.set(indexName, pipeline)
    }
  }

  const pipelineToModelId = new Map<string, string>()
  const pipelines = parseJsonFile<Record<string, Pipeline>>(files, 'pipelines.json')
  let pipelineCount = 0
  if (pipelines && typeof pipelines === 'object') {
    pipelineCount = Object.keys(pipelines).length
    for (const [pipelineName, pipeline] of Object.entries(pipelines)) {
      for (const proc of pipeline?.processors ?? []) {
        const inf = proc?.inference
        if (inf) {
          const modelId = inf.model_id ?? inf.inference_id
          if (modelId) {
            pipelineToModelId.set(pipelineName, modelId)
            break // first inference processor wins
          }
        }
      }
    }
  }

  return { indexToPipeline, pipelineToModelId, pipelineCount }
}
