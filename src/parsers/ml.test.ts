import { describe, it, expect } from 'vitest'
import { parseML } from './ml'
import type { IndexInfo } from './types'

const noIndices: IndexInfo[] = []

function makeIndex(name: string, docCount = 0, storeSizeBytes = 0): IndexInfo {
  return {
    name,
    isSystem: name.startsWith('.'),
    health: 'green',
    status: 'open',
    primaryShards: 1,
    replicaShards: 0,
    docCount,
    storeSizeBytes,
  }
}

describe('parseML', () => {
  it('returns null when ml_info, ml_trained_models, and ml_memory_stats are all absent', () => {
    expect(parseML(new Map(), noIndices)).toBeNull()
  })

  it('returns a result when only ml_info.json is present', () => {
    const files = new Map([
      ['commercial/ml_info.json', JSON.stringify({ native_code: { version: '8.0.0' }, upgrade_mode: false })],
    ])
    expect(parseML(files, noIndices)).not.toBeNull()
  })

  it('detects mlEnabled from presence of native_code key', () => {
    const files = new Map([
      ['commercial/ml_info.json', JSON.stringify({ native_code: { version: '8.0.0' }, upgrade_mode: false })],
    ])
    expect(parseML(files, noIndices)?.mlEnabled).toBe(true)
  })

  it('detects mlEnabled as false when native_code is absent', () => {
    const files = new Map([['commercial/ml_info.json', JSON.stringify({ upgrade_mode: false })]])
    expect(parseML(files, noIndices)?.mlEnabled).toBe(false)
  })

  it('detects upgradeMode: true', () => {
    const files = new Map([
      ['commercial/ml_info.json', JSON.stringify({ native_code: {}, upgrade_mode: true })],
    ])
    expect(parseML(files, noIndices)?.upgradeMode).toBe(true)
  })

  it('classifies ELSER model correctly', () => {
    const models = {
      count: 1,
      trained_model_configs: [{
        model_id: '.elser_model_2_linux-x86_64',
        model_type: 'pytorch',
        inference_config: { text_expansion: {} },
        license_level: 'platinum',
      }],
    }
    const files = new Map([
      ['commercial/ml_info.json', '{"native_code":{}}'],
      ['commercial/ml_trained_models.json', JSON.stringify(models)],
    ])
    const model = parseML(files, noIndices)?.trainedModels[0]
    expect(model?.modelClass).toBe('elser')
    expect(model?.inferenceTask).toBe('sparse_embedding')
  })

  it('classifies E5 model correctly', () => {
    const models = {
      count: 1,
      trained_model_configs: [{
        model_id: '.multilingual-e5-small_linux-x86_64',
        model_type: 'pytorch',
        inference_config: { text_embedding: {} },
        license_level: 'platinum',
      }],
    }
    const files = new Map([
      ['commercial/ml_info.json', '{"native_code":{}}'],
      ['commercial/ml_trained_models.json', JSON.stringify(models)],
    ])
    const model = parseML(files, noIndices)?.trainedModels[0]
    expect(model?.modelClass).toBe('e5')
    expect(model?.inferenceTask).toBe('text_embedding')
  })

  it('classifies lang_ident model correctly', () => {
    const models = {
      count: 1,
      trained_model_configs: [{
        model_id: 'lang_ident_model_1',
        model_type: 'lang_ident',
        inference_config: { classification: {} },
        license_level: 'basic',
      }],
    }
    const files = new Map([
      ['commercial/ml_info.json', '{"native_code":{}}'],
      ['commercial/ml_trained_models.json', JSON.stringify(models)],
    ])
    const model = parseML(files, noIndices)?.trainedModels[0]
    expect(model?.modelClass).toBe('lang_ident')
  })

  it('joins deployment stats onto trained models', () => {
    const models = {
      count: 1,
      trained_model_configs: [{
        model_id: '.elser_model_2_linux-x86_64',
        model_type: 'pytorch',
        inference_config: { text_expansion: {} },
        license_level: 'platinum',
      }],
    }
    const stats = {
      count: 1,
      trained_model_stats: [{
        model_id: '.elser_model_2_linux-x86_64',
        deployment_stats: {
          state: 'started',
          allocation_status: { allocation_count: 1, target_allocation_count: 1 },
          nodes: [{ average_inference_time_ms: 104.3 }],
        },
        inference_stats: { inference_count: 105, failure_count: 0 },
      }],
    }
    const files = new Map([
      ['commercial/ml_info.json', '{"native_code":{}}'],
      ['commercial/ml_trained_models.json', JSON.stringify(models)],
      ['commercial/ml_trained_models_stats.json', JSON.stringify(stats)],
    ])
    const model = parseML(files, noIndices)?.trainedModels[0]
    expect(model?.deployed).toBe(true)
    expect(model?.deploymentState).toBe('started')
    expect(model?.allocationCount).toBe(1)
    expect(model?.inferenceCount).toBe(105)
    expect(model?.avgInferenceTimeMs).toBeCloseTo(104.3)
  })

  it('parses anomaly job state, memory status, and datafeed state', () => {
    const detectors = {
      count: 1,
      jobs: [{ job_id: 'bill11', groups: [], custom_settings: {} }],
    }
    const statsJson = {
      count: 1,
      jobs: [{
        job_id: 'bill11',
        state: 'failed',
        model_size_stats: { memory_status: 'hard_limit', model_bytes: 841030212 },
        data_counts: { processed_record_count: 36393, bucket_count: 3280 },
        assignment_explanation: 'Insufficient memory',
      }],
    }
    const datafeeds = {
      count: 1,
      datafeeds: [{ datafeed_id: 'datafeed-bill11', job_id: 'bill11' }],
    }
    const datafeedStats = {
      count: 1,
      datafeeds: [{ datafeed_id: 'datafeed-bill11', state: 'stopped' }],
    }
    const files = new Map([
      ['commercial/ml_info.json', '{"native_code":{}}'],
      ['commercial/ml_anomaly_detectors.json', JSON.stringify(detectors)],
      ['commercial/ml_stats.json', JSON.stringify(statsJson)],
      ['commercial/ml_datafeeds.json', JSON.stringify(datafeeds)],
      ['commercial/ml_datafeeds_stats.json', JSON.stringify(datafeedStats)],
    ])
    const job = parseML(files, noIndices)?.anomalyJobs[0]
    expect(job?.state).toBe('failed')
    expect(job?.memoryStatus).toBe('hard_limit')
    expect(job?.datafeedState).toBe('stopped')
    expect(job?.assignmentExplanation).toBe('Insufficient memory')
    expect(job?.modelBytes).toBe(841030212)
  })

  it('detects Security anomaly job origin from groups', () => {
    const detectors = {
      count: 1,
      jobs: [{ job_id: 'siem-job', groups: ['security'], custom_settings: {} }],
    }
    const statsJson = {
      count: 1,
      jobs: [{
        job_id: 'siem-job',
        state: 'opened',
        model_size_stats: { memory_status: 'ok', model_bytes: 0 },
        data_counts: { processed_record_count: 0, bucket_count: 0 },
        assignment_explanation: '',
      }],
    }
    const files = new Map([
      ['commercial/ml_info.json', '{"native_code":{}}'],
      ['commercial/ml_anomaly_detectors.json', JSON.stringify(detectors)],
      ['commercial/ml_stats.json', JSON.stringify(statsJson)],
    ])
    expect(parseML(files, noIndices)?.anomalyJobs[0].origin).toBe('security')
  })

  it('detects Observability job origin from created_by', () => {
    const detectors = {
      count: 1,
      jobs: [{ job_id: 'apm-job', groups: [], custom_settings: { created_by: 'ml-module-apm_jobs' } }],
    }
    const statsJson = {
      count: 1,
      jobs: [{
        job_id: 'apm-job',
        state: 'opened',
        model_size_stats: { memory_status: 'ok', model_bytes: 0 },
        data_counts: { processed_record_count: 0, bucket_count: 0 },
        assignment_explanation: '',
      }],
    }
    const files = new Map([
      ['commercial/ml_info.json', '{"native_code":{}}'],
      ['commercial/ml_anomaly_detectors.json', JSON.stringify(detectors)],
      ['commercial/ml_stats.json', JSON.stringify(statsJson)],
    ])
    expect(parseML(files, noIndices)?.anomalyJobs[0].origin).toBe('observability')
  })

  it('parses ML node memory and excludes nodes with max_in_bytes = 0', () => {
    const memStats = {
      nodes: {
        'node-a': { name: 'data-node', mem: { ml: { max_in_bytes: 0, anomaly_detectors_in_bytes: 0, native_inference_in_bytes: 0, data_frame_analytics_in_bytes: 0 } } },
        'node-b': { name: 'ml-node', mem: { ml: { max_in_bytes: 851443712, anomaly_detectors_in_bytes: 321400432, native_inference_in_bytes: 0, data_frame_analytics_in_bytes: 0 } } },
      },
    }
    const files = new Map([['commercial/ml_memory_stats.json', JSON.stringify(memStats)]])
    const nodes = parseML(files, noIndices)?.mlNodeMemory
    expect(nodes).toHaveLength(1)
    expect(nodes?.[0].nodeName).toBe('ml-node')
    expect(nodes?.[0].maxBytes).toBe(851443712)
    expect(nodes?.[0].anomalyDetectorsBytes).toBe(321400432)
  })

  it('detects Security AI Assistant from index name', () => {
    const indices = [makeIndex('.ds-.kibana-elastic-ai-assistant-conversations-default-2026.01.30-000001')]
    const files = new Map([['commercial/ml_info.json', '{"native_code":{}}']])
    expect(parseML(files, indices)?.aiFeatures.hasSecurityAiAssistant).toBe(true)
  })

  it('detects Observability AI Assistant and counts conversations', () => {
    const indices = [makeIndex('.kibana-observability-ai-assistant-conversations-000001', 8)]
    const files = new Map([['commercial/ml_info.json', '{"native_code":{}}']])
    const result = parseML(files, indices)
    expect(result?.aiFeatures.hasObservabilityAiAssistant).toBe(true)
    expect(result?.aiFeatures.observabilityConversationCount).toBe(8)
  })

  it('counts inference endpoints from .inference index docCount', () => {
    const indices = [makeIndex('.inference', 42)]
    const files = new Map([['commercial/ml_info.json', '{"native_code":{}}']])
    expect(parseML(files, indices)?.aiFeatures.inferenceEndpointCount).toBe(42)
  })

  it('detects Agent Builder chat indices and counts docs', () => {
    const indices = [
      makeIndex('.chat-agents-000001', 6),
      makeIndex('.chat-conversations-000001', 27),
      makeIndex('.chat-tools-000001', 8),
    ]
    const files = new Map([['commercial/ml_info.json', '{"native_code":{}}']])
    const features = parseML(files, indices)?.aiFeatures
    expect(features?.hasChatAgents).toBe(true)
    expect(features?.chatAgentCount).toBe(6)
    expect(features?.chatConversationCount).toBe(27)
    expect(features?.chatToolCount).toBe(8)
  })

  it('sums ml-inference-native storage bytes', () => {
    const indices = [
      makeIndex('.ml-inference-native-000001', 0, 400000000),
      makeIndex('.ml-inference-native-000002', 0, 383500000),
    ]
    const files = new Map([['commercial/ml_info.json', '{"native_code":{}}']])
    expect(parseML(files, indices)?.aiFeatures.mlInferenceStorageBytes).toBe(783500000)
  })
})
