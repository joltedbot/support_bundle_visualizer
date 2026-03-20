import { parseJsonFile } from '../utils/bundleReader'
import type { MLInfo } from './types'

interface MLInfoJson {
  native_code?: unknown
  upgrade_mode?: boolean
  defaults?: unknown
}

interface MLTrainedModelsJson {
  count?: number
  trained_model_configs?: unknown[]
}

interface MLMemoryStatsJson {
  nodes?: Record<string, {
    mem?: {
      ml?: {
        anomaly_detectors_in_bytes?: number
        native_inference_in_bytes?: number
        data_frame_analytics_in_bytes?: number
      }
    }
  }>
  _all?: {
    mem?: {
      anomaly_detectors_in_bytes?: number
      trained_models_in_bytes?: number
      native_inference_in_bytes?: number
    }
  }
}

interface MMAnomalyDetectorsJson {
  count?: {
    total?: number
  }
  jobs?: { count?: { total?: number } }
}

/**
 * Parse commercial/ml_info.json + commercial/ml_trained_models.json +
 * commercial/ml_memory_stats.json → MLInfo.
 * Returns null if all files are missing.
 */
export function parseML(files: Map<string, string>): MLInfo | null {
  const mlInfo = parseJsonFile<MLInfoJson>(files, 'commercial/ml_info.json')
  const trainedModels = parseJsonFile<MLTrainedModelsJson>(files, 'commercial/ml_trained_models.json')
  const memStats = parseJsonFile<MLMemoryStatsJson>(files, 'commercial/ml_memory_stats.json')
  const mlStats = parseJsonFile<MMAnomalyDetectorsJson>(files, 'commercial/ml_stats.json')
  const anomalyDetectors = parseJsonFile<MMAnomalyDetectorsJson>(files, 'commercial/ml_anomaly_detectors.json')

  if (!mlInfo && !trainedModels && !memStats) return null

  // Enabled: native_code key present and truthy in ml_info
  const enabled = mlInfo !== null && 'native_code' in (mlInfo ?? {}) && Boolean(mlInfo?.native_code)

  // Anomaly detection job count: try ml_anomaly_detectors, then ml_stats, then ml_info
  let anomalyDetectionJobCount =
    anomalyDetectors?.count?.total ??
    mlStats?.count?.total ??
    0

  // Trained model count
  const trainedModelCount =
    trainedModels?.count ??
    trainedModels?.trained_model_configs?.length ??
    0

  // Memory usage: sum from _all if available, otherwise sum node-level ml memory
  let memoryUsageBytes = 0
  if (memStats?._all?.mem) {
    const allMem = memStats._all.mem
    memoryUsageBytes =
      (allMem.anomaly_detectors_in_bytes ?? 0) +
      (allMem.trained_models_in_bytes ?? 0)
  } else if (memStats?.nodes) {
    for (const node of Object.values(memStats.nodes)) {
      const ml = node.mem?.ml
      if (ml) {
        memoryUsageBytes +=
          (ml.anomaly_detectors_in_bytes ?? 0) +
          (ml.native_inference_in_bytes ?? 0) +
          (ml.data_frame_analytics_in_bytes ?? 0)
      }
    }
  }

  // Override anomaly count from anomaly detectors file if available
  if (anomalyDetectors?.count?.total !== undefined) {
    anomalyDetectionJobCount = anomalyDetectors.count.total
  }

  return {
    enabled,
    anomalyDetectionJobCount,
    trainedModelCount,
    memoryUsageBytes,
  }
}
