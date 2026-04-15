import { parseJsonFile } from '../utils/bundleReader'
import type { DenseVectorDimGroup, FeatureInfo, IndexInfo } from './types'

interface WatcherStatsJson {
  stats?: Array<{ watch_count?: number }>
}

interface TransformJson {
  count?: number
  transforms?: unknown[]
}

interface EnrichPoliciesJson {
  policies?: unknown[]
}

interface CCRStatsJson {
  follow_stats?: { indices?: unknown[] }
}

interface RemoteClusterJson {
  [key: string]: unknown
}

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

const OBSERVABILITY_PATTERNS = [
  /^\.logs-/,
  /^\.metrics-/,
  /^\.traces-/,
  /^apm-/,
  /^filebeat-/,
  /^metricbeat-/,
  /^logs-/,
  /^metrics-/,
  /^traces-/,
]

const SECURITY_PATTERNS = [
  /^\.siem-/,
  /^\.alerts-security\./,
  /^security_audit/,
  /^\.lists-/,
  /^\.items-/,
]

type DenseVectorField = { dims: number; inferenceId: string | null }

type MappingScanResult = {
  hasDenseVector: boolean
  hasSparseVector: boolean
  hasSemanticText: boolean
  hasGeoFields: boolean
  denseVectorFields: DenseVectorField[]
  inferenceIds: string[]   // all inference_id values found on any field type
}

/**
 * Recursively scan mapping properties for specific field types.
 * Returns flags, dense_vector field details, and all inference_id references found.
 */
function scanMappingProperties(
  props: Record<string, MappingValue>,
  depth = 0
): MappingScanResult {
  let hasDenseVector = false
  let hasSparseVector = false
  let hasSemanticText = false
  let hasGeoFields = false
  const denseVectorFields: DenseVectorField[] = []
  const inferenceIds: string[] = []

  if (depth > 10) return { hasDenseVector, hasSparseVector, hasSemanticText, hasGeoFields, denseVectorFields, inferenceIds }

  for (const field of Object.values(props)) {
    if (!field || typeof field !== 'object') continue
    const type = field.type
    if (type === 'dense_vector') {
      hasDenseVector = true
      denseVectorFields.push({ dims: field.dims ?? 0, inferenceId: field.inference_id ?? null })
      if (field.inference_id) inferenceIds.push(field.inference_id)
    }
    if (type === 'sparse_vector') hasSparseVector = true
    if (type === 'semantic_text') {
      hasSemanticText = true
      if (field.inference_id) inferenceIds.push(field.inference_id)
    }
    if (type === 'geo_point' || type === 'geo_shape') hasGeoFields = true

    if (field.properties) {
      const sub = scanMappingProperties(field.properties, depth + 1)
      if (sub.hasDenseVector) hasDenseVector = true
      if (sub.hasSparseVector) hasSparseVector = true
      if (sub.hasSemanticText) hasSemanticText = true
      if (sub.hasGeoFields) hasGeoFields = true
      denseVectorFields.push(...sub.denseVectorFields)
      inferenceIds.push(...sub.inferenceIds)
    }
    if (field.fields) {
      const sub = scanMappingProperties(field.fields, depth + 1)
      if (sub.hasDenseVector) hasDenseVector = true
      if (sub.hasSparseVector) hasSparseVector = true
      if (sub.hasSemanticText) hasSemanticText = true
      if (sub.hasGeoFields) hasGeoFields = true
      denseVectorFields.push(...sub.denseVectorFields)
      inferenceIds.push(...sub.inferenceIds)
    }
  }

  return { hasDenseVector, hasSparseVector, hasSemanticText, hasGeoFields, denseVectorFields, inferenceIds }
}

/**
 * Parse features from multiple files + the already-parsed IndexInfo[].
 */
export function parseFeatures(
  files: Map<string, string>,
  indices: IndexInfo[]
): FeatureInfo | null {
  // Solution types from index names
  const solutionTypes = new Set<'search' | 'observability' | 'security'>()
  for (const idx of indices) {
    if (idx.isSystem) continue
    for (const pattern of OBSERVABILITY_PATTERNS) {
      if (pattern.test(idx.name)) {
        solutionTypes.add('observability')
        break
      }
    }
    for (const pattern of SECURITY_PATTERNS) {
      if (pattern.test(idx.name)) {
        solutionTypes.add('security')
        break
      }
    }
  }
  if (solutionTypes.size === 0) solutionTypes.add('search')

  // Build index → default pipeline lookup from settings.json
  const indexToPipeline = new Map<string, string>()
  const settingsRaw = parseJsonFile<Record<string, SettingsIndex>>(files, 'settings.json')
  if (settingsRaw && typeof settingsRaw === 'object') {
    for (const [indexName, indexSettings] of Object.entries(settingsRaw)) {
      const idxBlock = indexSettings?.settings?.index
      const pipeline = idxBlock?.default_pipeline ?? idxBlock?.final_pipeline
      if (pipeline) indexToPipeline.set(indexName, pipeline)
    }
  }

  // Build pipeline → model_id lookup from pipelines.json inference processors
  const pipelineToModelId = new Map<string, string>()
  const pipelines = parseJsonFile<Record<string, Pipeline>>(files, 'pipelines.json')
  const ingestPipelineCount = pipelines ? Object.keys(pipelines).length : 0
  const hasIngestPipelines = ingestPipelineCount > 0
  if (pipelines && typeof pipelines === 'object') {
    for (const [pipelineName, pipeline] of Object.entries(pipelines)) {
      for (const proc of pipeline?.processors ?? []) {
        const inf = proc?.inference
        if (inf) {
          const modelId = inf.model_id ?? inf.inference_id
          if (modelId) { pipelineToModelId.set(pipelineName, modelId); break }
        }
      }
    }
  }

  // Collect inference IDs referenced in pipeline inference processors (globally)
  const pipelineInferenceIds = new Set<string>()
  for (const modelId of pipelineToModelId.values()) {
    pipelineInferenceIds.add(modelId)
  }

  // Mapping scan for field types
  let hasVectorSearch = false
  let hasSemanticText = false
  let hasGeoFields = false
  let semanticTextIndexCount = 0
  let denseVectorIndexCount = 0
  let sparseVectorIndexCount = 0
  const semanticTextIndexNames: string[] = []
  const sparseVectorIndexNames: string[] = []
  // composite key "dims::inferenceId" → { dims, count, inferenceId, indexNames }
  const dimMap = new Map<string, { dims: number; count: number; inferenceId: string | null; indexNames: string[] }>()
  const mappingInferenceIds = new Set<string>()

  const mappingRaw = parseJsonFile<Record<string, MappingIndex>>(files, 'mapping.json')
  if (mappingRaw && typeof mappingRaw === 'object') {
    for (const [indexName, indexMapping] of Object.entries(mappingRaw)) {
      if (!indexMapping?.mappings?.properties) continue
      const result = scanMappingProperties(indexMapping.mappings.properties)
      if (result.hasDenseVector) {
        hasVectorSearch = true
        denseVectorIndexCount++
        const dvField = result.denseVectorFields[0]
        if (dvField) {
          // Resolve inferenceId: field-level → ingest pipeline model → null (external)
          const resolvedId =
            dvField.inferenceId ??
            pipelineToModelId.get(indexToPipeline.get(indexName) ?? '') ??
            null
          const key = `${dvField.dims}::${resolvedId ?? ''}`
          const existing = dimMap.get(key)
          if (existing) {
            existing.count++
            existing.indexNames.push(indexName)
          } else {
            dimMap.set(key, { dims: dvField.dims, count: 1, inferenceId: resolvedId, indexNames: [indexName] })
          }
        }
      }
      if (result.hasSparseVector) { hasVectorSearch = true; sparseVectorIndexCount++; sparseVectorIndexNames.push(indexName) }
      if (result.hasSemanticText) {
        hasSemanticText = true
        semanticTextIndexCount++
        semanticTextIndexNames.push(indexName)
      }
      if (result.hasGeoFields) hasGeoFields = true
      for (const id of result.inferenceIds) mappingInferenceIds.add(id)
      // No early exit — must count all indices
    }
  }

  const activeInferenceEndpoints = Array.from(
    new Set([...mappingInferenceIds, ...pipelineInferenceIds])
  ).sort()

  const denseVectorDimGroups: DenseVectorDimGroup[] = Array.from(dimMap.values())
    .sort((a, b) => b.count - a.count)
    .map(g => ({ ...g, indexNames: g.indexNames.sort() }))

  // Watcher
  const watcherStats = parseJsonFile<WatcherStatsJson>(files, 'commercial/watcher_stats.json')
  let watcherCount = 0
  if (watcherStats?.stats) {
    for (const stat of watcherStats.stats) {
      watcherCount += stat.watch_count ?? 0
    }
  }
  const hasWatcher = watcherCount > 0

  // Transforms
  const transformJson = parseJsonFile<TransformJson>(files, 'commercial/transform.json')
  const transformCount =
    transformJson?.count ??
    transformJson?.transforms?.length ??
    0
  const hasTransforms = transformCount > 0

  // Enrich policies
  const enrichJson = parseJsonFile<EnrichPoliciesJson>(files, 'commercial/enrich_policies.json')
  const enrichPolicyCount = enrichJson?.policies?.length ?? 0
  const hasEnrich = enrichPolicyCount > 0

  // CCR
  const ccrStats = parseJsonFile<CCRStatsJson>(files, 'commercial/ccr_stats.json')
  const followerIndices = ccrStats?.follow_stats?.indices ?? []
  const hasCCR = Array.isArray(followerIndices) ? followerIndices.length > 0 : false

  // CCS (remote clusters)
  const remoteClusters = parseJsonFile<RemoteClusterJson>(files, 'remote_cluster_info.json')
  const remoteClusterKeys = remoteClusters ? Object.keys(remoteClusters) : []
  const hasCCS = remoteClusterKeys.length > 0

  // ILM
  const ilmPolicies = parseJsonFile<Record<string, unknown>>(files, 'commercial/ilm_policies.json')
  const hasILM = ilmPolicies ? Object.keys(ilmPolicies).length > 0 : false

  // ML
  const mlInfo = parseJsonFile<Record<string, unknown>>(files, 'commercial/ml_info.json')
  const hasML = mlInfo !== null

  // Logstash
  const logstashRaw = parseJsonFile<Record<string, unknown>>(files, 'commercial/logstash_pipeline.json')
  const logstashPipelines = logstashRaw ? Object.keys(logstashRaw).length : 0

  return {
    solutionTypes: Array.from(solutionTypes),
    hasVectorSearch,
    hasSemanticText,
    hasGeoFields,
    semanticTextIndexCount,
    semanticTextIndexNames,
    denseVectorIndexCount,
    denseVectorDimGroups,
    sparseVectorIndexCount,
    sparseVectorIndexNames,
    hasML,
    hasILM,
    hasCCR,
    hasCCS,
    hasIngestPipelines,
    hasWatcher,
    hasTransforms,
    hasEnrich,
    ingestPipelineCount,
    watcherCount,
    transformCount,
    enrichPolicyCount,
    logstash: logstashPipelines,
    activeInferenceEndpoints,
  }
}
