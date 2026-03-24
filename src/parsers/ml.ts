import { parseJsonFile } from '../utils/bundleReader'
import type {
  AiMlInfo, AnomalyJob, TrainedModel, DFAJob, MLNodeMemory, AIFeatures,
  AnomalyJobState, MemoryStatus, DatafeedState, JobOrigin, ModelClass, DFAType,
  IndexInfo,
} from './types'

// ── Raw JSON shapes ───────────────────────────────────────────────────────────

interface MLInfoJson {
  native_code?: unknown
  upgrade_mode?: boolean
}

interface AnomalyDetectorsJson {
  jobs?: Array<{
    job_id?: string
    groups?: string[]
    custom_settings?: { created_by?: string }
  }>
}

interface MLStatsJson {
  jobs?: Array<{
    job_id?: string
    state?: string
    model_size_stats?: { memory_status?: string; model_bytes?: number }
    data_counts?: { processed_record_count?: number; bucket_count?: number }
    assignment_explanation?: string
  }>
}

interface DatafeedsJson {
  datafeeds?: Array<{ datafeed_id?: string; job_id?: string }>
}

interface DatafeedStatsJson {
  datafeeds?: Array<{ datafeed_id?: string; state?: string }>
}

interface TrainedModelsJson {
  count?: number
  trained_model_configs?: Array<{
    model_id?: string
    model_type?: string
    inference_config?: Record<string, unknown>
    license_level?: string
  }>
}

interface TrainedModelStatsJson {
  trained_model_stats?: Array<{
    model_id?: string
    deployment_stats?: {
      state?: string
      allocation_status?: { allocation_count?: number; target_allocation_count?: number }
      nodes?: Array<{ average_inference_time_ms?: number }>
    } | null
    inference_stats?: { inference_count?: number }
  }>
}

interface DFAJson {
  data_frame_analytics?: Array<{
    id?: string
    analysis?: Record<string, unknown>
  }>
}

interface DFAStatsJson {
  data_frame_analytics?: Array<{ id?: string; state?: string }>
}

interface MemoryStatsJson {
  nodes?: Record<string, {
    name?: string
    mem?: {
      ml?: {
        max_in_bytes?: number
        anomaly_detectors_in_bytes?: number
        native_inference_in_bytes?: number
        data_frame_analytics_in_bytes?: number
      }
    }
  }>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function classifyModel(
  modelId: string,
  modelType: string,
  inferenceConfig: Record<string, unknown>
): { modelClass: ModelClass; inferenceTask: string | null } {
  if (modelId === 'lang_ident_model_1') return { modelClass: 'lang_ident', inferenceTask: null }
  if (modelId.startsWith('.elser')) return { modelClass: 'elser', inferenceTask: 'sparse_embedding' }
  if (modelId.startsWith('.multilingual-e5')) return { modelClass: 'e5', inferenceTask: 'text_embedding' }
  if (modelType === 'tree_ensemble' || modelType === 'ensemble') return { modelClass: 'dfa', inferenceTask: null }

  const taskMap: Record<string, string> = {
    text_expansion: 'sparse_embedding',
    text_embedding: 'text_embedding',
    ner: 'named_entity_recognition',
    text_classification: 'text_classification',
    zero_shot_classification: 'zero_shot_classification',
    question_answering: 'question_answering',
    fill_mask: 'fill_mask',
    pass_through: 'pass_through',
    text_similarity: 'text_similarity',
  }
  const taskKey = Object.keys(inferenceConfig).find(k => k in taskMap)
  return { modelClass: 'nlp', inferenceTask: taskKey ? taskMap[taskKey] : null }
}

function detectOrigin(groups: string[], createdBy: string): JobOrigin {
  if (groups.includes('security') || /ml-module-(security|siem)/.test(createdBy)) return 'security'
  if (groups.includes('observability') || /ml-module-(metrics-ui|logs-ui|apm)/.test(createdBy)) return 'observability'
  return 'user'
}

function detectAiFeatures(indices: IndexInfo[]): AIFeatures {
  let hasSecurityAiAssistant = false
  let hasObservabilityAiAssistant = false
  let observabilityConversationCount = 0
  let hasChatAgents = false
  let chatAgentCount = 0
  let chatConversationCount = 0
  let chatToolCount = 0
  let hasProductDocIndices = false
  let productDocIndexCount = 0
  let inferenceEndpointCount = 0
  let mlInferenceStorageBytes = 0

  for (const idx of indices) {
    const { name, docCount, storeSizeBytes } = idx
    if (/^\.kibana-elastic-ai-assistant-|^\.ds-\.kibana-elastic-ai-assistant-/.test(name)) {
      hasSecurityAiAssistant = true
    }
    if (/^\.kibana-observability-ai-assistant-/.test(name)) {
      hasObservabilityAiAssistant = true
      if (/conversations/.test(name)) observabilityConversationCount += docCount
    }
    if (/^\.chat-agents-/.test(name)) { hasChatAgents = true; chatAgentCount += docCount }
    if (/^\.chat-conversations-/.test(name)) { hasChatAgents = true; chatConversationCount += docCount }
    if (/^\.chat-tools-/.test(name)) { hasChatAgents = true; chatToolCount += docCount }
    if (/^\.kibana_ai_product_doc_/.test(name)) { hasProductDocIndices = true; productDocIndexCount++ }
    if (name === '.inference') inferenceEndpointCount = docCount
    if (/^\.ml-inference-native-/.test(name)) mlInferenceStorageBytes += storeSizeBytes
  }

  return {
    hasSecurityAiAssistant, hasObservabilityAiAssistant, observabilityConversationCount,
    hasChatAgents, chatAgentCount, chatConversationCount, chatToolCount,
    hasProductDocIndices, productDocIndexCount, inferenceEndpointCount, mlInferenceStorageBytes,
  }
}

// ── Main parser ───────────────────────────────────────────────────────────────

export function parseML(files: Map<string, string>, indices: IndexInfo[]): AiMlInfo | null {
  const mlInfo = parseJsonFile<MLInfoJson>(files, 'commercial/ml_info.json')
  const trainedModelsJson = parseJsonFile<TrainedModelsJson>(files, 'commercial/ml_trained_models.json')
  const memStatsJson = parseJsonFile<MemoryStatsJson>(files, 'commercial/ml_memory_stats.json')

  if (!mlInfo && !trainedModelsJson && !memStatsJson) return null

  // ── Status ──────────────────────────────────────────────────────────────────
  const mlEnabled = mlInfo !== null && 'native_code' in (mlInfo ?? {}) && Boolean(mlInfo?.native_code)
  const upgradeMode = mlInfo?.upgrade_mode ?? false

  // ── Anomaly Detection ───────────────────────────────────────────────────────
  const detectorsJson = parseJsonFile<AnomalyDetectorsJson>(files, 'commercial/ml_anomaly_detectors.json')
  const statsJson = parseJsonFile<MLStatsJson>(files, 'commercial/ml_stats.json')
  const datafeedsJson = parseJsonFile<DatafeedsJson>(files, 'commercial/ml_datafeeds.json')
  const datafeedStatsJson = parseJsonFile<DatafeedStatsJson>(files, 'commercial/ml_datafeeds_stats.json')

  // job_id → datafeed_id (handles custom datafeed names)
  const jobToDatafeedId = new Map<string, string>()
  for (const df of datafeedsJson?.datafeeds ?? []) {
    if (df.job_id && df.datafeed_id) jobToDatafeedId.set(df.job_id, df.datafeed_id)
  }

  // datafeed_id → state
  const datafeedIdToState = new Map<string, DatafeedState>()
  for (const df of datafeedStatsJson?.datafeeds ?? []) {
    if (df.datafeed_id && df.state) datafeedIdToState.set(df.datafeed_id, df.state as DatafeedState)
  }

  // job_id → stats
  const jobIdToStats = new Map<string, NonNullable<MLStatsJson['jobs']>[number]>()
  for (const job of statsJson?.jobs ?? []) {
    if (job.job_id) jobIdToStats.set(job.job_id, job)
  }

  const anomalyJobs: AnomalyJob[] = []
  for (const det of detectorsJson?.jobs ?? []) {
    const jobId = det.job_id ?? ''
    const stats = jobIdToStats.get(jobId)
    const datafeedId = jobToDatafeedId.get(jobId) ?? `datafeed-${jobId}`
    const datafeedState = datafeedIdToState.get(datafeedId) ?? null
    anomalyJobs.push({
      jobId,
      state: (stats?.state ?? 'closed') as AnomalyJobState,
      datafeedState,
      memoryStatus: (stats?.model_size_stats?.memory_status ?? 'ok') as MemoryStatus,
      modelBytes: stats?.model_size_stats?.model_bytes ?? 0,
      processedRecordCount: stats?.data_counts?.processed_record_count ?? 0,
      bucketCount: stats?.data_counts?.bucket_count ?? 0,
      origin: detectOrigin(det.groups ?? [], det.custom_settings?.created_by ?? ''),
      assignmentExplanation: stats?.assignment_explanation ?? '',
    })
  }

  // ── Trained Models ──────────────────────────────────────────────────────────
  const modelStatsJson = parseJsonFile<TrainedModelStatsJson>(files, 'commercial/ml_trained_models_stats.json')

  // model_id → first stats entry (duplicates arise when a model has multiple deployments)
  const modelIdToStats = new Map<string, NonNullable<TrainedModelStatsJson['trained_model_stats']>[number]>()
  for (const s of modelStatsJson?.trained_model_stats ?? []) {
    if (s.model_id && !modelIdToStats.has(s.model_id)) modelIdToStats.set(s.model_id, s)
  }

  const trainedModels: TrainedModel[] = []
  for (const cfg of trainedModelsJson?.trained_model_configs ?? []) {
    const modelId = cfg.model_id ?? ''
    const { modelClass, inferenceTask } = classifyModel(modelId, cfg.model_type ?? '', cfg.inference_config ?? {})
    const stats = modelIdToStats.get(modelId)
    const dep = stats?.deployment_stats ?? null
    const nodeTimes = (dep?.nodes ?? [])
      .map(n => n.average_inference_time_ms)
      .filter((t): t is number => typeof t === 'number' && t > 0)
    trainedModels.push({
      modelId,
      modelClass,
      inferenceTask,
      deployed: dep !== null && dep.state === 'started',
      deploymentState: (dep?.state ?? null) as TrainedModel['deploymentState'],
      allocationCount: dep?.allocation_status?.allocation_count ?? 0,
      targetAllocationCount: dep?.allocation_status?.target_allocation_count ?? 0,
      inferenceCount: stats?.inference_stats?.inference_count ?? 0,
      avgInferenceTimeMs: nodeTimes.length > 0 ? nodeTimes.reduce((a, b) => a + b, 0) / nodeTimes.length : null,
      licenseLevel: cfg.license_level ?? 'basic',
    })
  }

  // ── Data Frame Analytics ────────────────────────────────────────────────────
  const dfaJson = parseJsonFile<DFAJson>(files, 'commercial/ml_dataframe.json')
  const dfaStatsJson = parseJsonFile<DFAStatsJson>(files, 'commercial/ml_dataframe_stats.json')
  const dfaIdToState = new Map<string, string>()
  for (const j of dfaStatsJson?.data_frame_analytics ?? []) {
    if (j.id && j.state) dfaIdToState.set(j.id, j.state)
  }
  const dfaJobs: DFAJob[] = []
  for (const job of dfaJson?.data_frame_analytics ?? []) {
    const id = job.id ?? ''
    const analysisType = Object.keys(job.analysis ?? {})[0] as DFAType | undefined
    if (!analysisType) continue
    dfaJobs.push({ id, analysisType, state: dfaIdToState.get(id) ?? 'stopped' })
  }

  // ── ML Memory ───────────────────────────────────────────────────────────────
  const mlNodeMemory: MLNodeMemory[] = []
  for (const node of Object.values(memStatsJson?.nodes ?? {})) {
    const ml = node.mem?.ml
    if (!ml || (ml.max_in_bytes ?? 0) === 0) continue
    mlNodeMemory.push({
      nodeName: node.name ?? 'unknown',
      maxBytes: ml.max_in_bytes ?? 0,
      anomalyDetectorsBytes: ml.anomaly_detectors_in_bytes ?? 0,
      nativeInferenceBytes: ml.native_inference_in_bytes ?? 0,
      dataFrameAnalyticsBytes: ml.data_frame_analytics_in_bytes ?? 0,
    })
  }

  return {
    mlEnabled,
    upgradeMode,
    anomalyJobs,
    trainedModels,
    dfaJobs,
    mlNodeMemory,
    aiFeatures: detectAiFeatures(indices),
    // Populated with real values in parsers/index.ts after the features mapping scan runs
    semanticTextIndexCount: 0,
    denseVectorIndexCount: 0,
    sparseVectorIndexCount: 0,
  }
}
