import type { AiMlInfo, FeatureInfo, TrainedModel } from '../../parsers/types'

// lang_ident_model_1 is always present but decorative — it never counts as ML content
export function significantModels(models: TrainedModel[]): TrainedModel[] {
  return models.filter((m) => m.modelClass !== 'lang_ident')
}

// Indices with semantic_text, dense_vector or sparse_vector fields
export function semanticIndexCount(features: FeatureInfo | null): number {
  return (
    (features?.semanticTextIndexCount ?? 0) +
    (features?.denseVectorIndexCount ?? 0) +
    (features?.sparseVectorIndexCount ?? 0)
  )
}

export function hasAnything(aiMl: AiMlInfo, features: FeatureInfo | null): boolean {
  const semanticCount = semanticIndexCount(features)
  return (
    aiMl.anomalyJobs.length > 0 ||
    significantModels(aiMl.trainedModels).length > 0 ||
    aiMl.dfaJobs.length > 0 ||
    semanticCount > 0 ||
    aiMl.aiFeatures.hasSecurityAiAssistant ||
    aiMl.aiFeatures.hasObservabilityAiAssistant ||
    aiMl.aiFeatures.hasChatAgents ||
    aiMl.aiFeatures.inferenceEndpointCount > 0
  )
}
