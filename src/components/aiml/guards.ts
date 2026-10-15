import type { AiMlInfo, FeatureInfo, TrainedModel } from '../../parsers/types'

// lang_ident_model_1 is always present but decorative — it never counts as ML content
export function significantModels(models: TrainedModel[]): TrainedModel[] {
  return models.filter((m) => m.modelClass !== 'lang_ident')
}

export function hasAnything(aiMl: AiMlInfo, features: FeatureInfo | null): boolean {
  const semanticCount =
    (features?.semanticTextIndexCount ?? 0) +
    (features?.denseVectorIndexCount ?? 0) +
    (features?.sparseVectorIndexCount ?? 0)
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
