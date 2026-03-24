import { parseJsonFile } from '../utils/bundleReader'
import type { FeatureInfo, IndexInfo } from './types'

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
  properties?: Record<string, MappingValue>
  fields?: Record<string, MappingValue>
}

type MappingIndex = {
  mappings?: {
    properties?: Record<string, MappingValue>
  }
}

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

/**
 * Recursively scan mapping properties for specific field types.
 * Returns flags: hasDenseVector, hasSparseVector, hasSemanticText, hasGeoFields.
 */
function scanMappingProperties(
  props: Record<string, MappingValue>,
  depth = 0
): { hasDenseVector: boolean; hasSparseVector: boolean; hasSemanticText: boolean; hasGeoFields: boolean } {
  let hasDenseVector = false
  let hasSparseVector = false
  let hasSemanticText = false
  let hasGeoFields = false

  if (depth > 10) return { hasDenseVector, hasSparseVector, hasSemanticText, hasGeoFields }

  for (const field of Object.values(props)) {
    if (!field || typeof field !== 'object') continue
    const type = field.type
    if (type === 'dense_vector') hasDenseVector = true
    if (type === 'sparse_vector') hasSparseVector = true
    if (type === 'semantic_text') hasSemanticText = true
    if (type === 'geo_point' || type === 'geo_shape') hasGeoFields = true

    if (field.properties) {
      const sub = scanMappingProperties(field.properties, depth + 1)
      if (sub.hasDenseVector) hasDenseVector = true
      if (sub.hasSparseVector) hasSparseVector = true
      if (sub.hasSemanticText) hasSemanticText = true
      if (sub.hasGeoFields) hasGeoFields = true
    }
    if (field.fields) {
      const sub = scanMappingProperties(field.fields, depth + 1)
      if (sub.hasDenseVector) hasDenseVector = true
      if (sub.hasSparseVector) hasSparseVector = true
      if (sub.hasSemanticText) hasSemanticText = true
      if (sub.hasGeoFields) hasGeoFields = true
    }
  }

  return { hasDenseVector, hasSparseVector, hasSemanticText, hasGeoFields }
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

  // Mapping scan for field types
  let hasVectorSearch = false
  let hasSemanticText = false
  let hasGeoFields = false
  let semanticTextIndexCount = 0
  let denseVectorIndexCount = 0
  let sparseVectorIndexCount = 0
  const semanticTextIndexNames: string[] = []

  const mappingRaw = parseJsonFile<Record<string, MappingIndex>>(files, 'mapping.json')
  if (mappingRaw && typeof mappingRaw === 'object') {
    for (const [indexName, indexMapping] of Object.entries(mappingRaw)) {
      if (!indexMapping?.mappings?.properties) continue
      const result = scanMappingProperties(indexMapping.mappings.properties)
      if (result.hasDenseVector) { hasVectorSearch = true; denseVectorIndexCount++ }
      if (result.hasSparseVector) { hasVectorSearch = true; sparseVectorIndexCount++ }
      if (result.hasSemanticText) {
        hasSemanticText = true
        semanticTextIndexCount++
        semanticTextIndexNames.push(indexName)
      }
      if (result.hasGeoFields) hasGeoFields = true
      // No early exit — must count all indices
    }
  }

  // Ingest pipelines
  const pipelines = parseJsonFile<Record<string, unknown>>(files, 'pipelines.json')
  const ingestPipelineCount = pipelines ? Object.keys(pipelines).length : 0
  const hasIngestPipelines = ingestPipelineCount > 0

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

  return {
    solutionTypes: Array.from(solutionTypes),
    hasVectorSearch,
    hasSemanticText,
    hasGeoFields,
    semanticTextIndexCount,
    semanticTextIndexNames,
    denseVectorIndexCount,
    sparseVectorIndexCount,
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
  }
}
