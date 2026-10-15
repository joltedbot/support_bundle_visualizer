import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiPanel,
  EuiStat,
  EuiText,
  EuiSpacer,
  EuiBadge,
} from '@elastic/eui'
import type { AiMlInfo, FeatureInfo } from '../parsers/types'
import { modelClassLabel } from './aiml/labels'
import { AnomalyDetectionPanel } from './aiml/AnomalyDetectionPanel'
import { TrainedModelsPanel } from './aiml/TrainedModelsPanel'
import { DFAPanel } from './aiml/DFAPanel'
import { MLMemoryPanel } from './aiml/MLMemoryPanel'
import { SemanticSearchPanel } from './aiml/SemanticSearchPanel'
import { AIFeaturesPanel } from './aiml/AIFeaturesPanel'
import { significantModels, hasAnything } from './aiml/guards'

interface Props {
  aiMl: AiMlInfo
  features: FeatureInfo | null
}

// ── Status ────────────────────────────────────────────────────────────────────

type EuiBadgeColor = 'success' | 'danger' | 'default'
type StatusInfo = { label: string; color: EuiBadgeColor }

function getStatus(aiMl: AiMlInfo, features: FeatureInfo | null): StatusInfo {
  const hasIssues =
    aiMl.anomalyJobs.some(
      (j) => j.state === 'failed' || j.memoryStatus === 'hard_limit',
    ) ||
    significantModels(aiMl.trainedModels).some(
      (m) => m.deploymentState === 'failed',
    )
  if (hasIssues) return { label: 'Issues Detected', color: 'danger' }

  const semanticCount =
    (features?.semanticTextIndexCount ?? 0) +
    (features?.denseVectorIndexCount ?? 0) +
    (features?.sparseVectorIndexCount ?? 0)
  const isActive =
    aiMl.anomalyJobs.some((j) => j.state === 'opened') ||
    significantModels(aiMl.trainedModels).some((m) => m.deployed) ||
    semanticCount > 0 ||
    aiMl.aiFeatures.hasSecurityAiAssistant ||
    aiMl.aiFeatures.hasObservabilityAiAssistant ||
    aiMl.aiFeatures.hasChatAgents
  if (isActive) return { label: 'Active', color: 'success' }

  return { label: 'Licensed', color: 'default' }
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AiMlSection({ aiMl, features }: Props) {
  if (!hasAnything(aiMl, features)) return null

  const status = getStatus(aiMl, features)
  const nonTrivialModels = significantModels(aiMl.trainedModels)
  const mlNodes = aiMl.mlNodeMemory.filter((n) => n.maxBytes > 0)

  const semanticCount =
    (features?.semanticTextIndexCount ?? 0) +
    (features?.denseVectorIndexCount ?? 0) +
    (features?.sparseVectorIndexCount ?? 0)

  const { aiFeatures } = aiMl
  const activeInferenceEndpoints = features?.activeInferenceEndpoints ?? []
  const showSemanticPanel = semanticCount > 0
  const showAiFeaturesPanel =
    aiFeatures.hasSecurityAiAssistant ||
    aiFeatures.hasObservabilityAiAssistant ||
    aiFeatures.hasChatAgents ||
    aiFeatures.hasProductDocIndices ||
    (features?.activeInferenceEndpoints.length ?? 0) > 0 ||
    aiFeatures.mlInferenceStorageBytes > 0 ||
    (features?.denseVectorDimGroups.filter((g) => g.inferenceId === null)
      .length ?? 0) > 0

  // Anomaly job breakdowns for stat card
  const openedJobs = aiMl.anomalyJobs.filter(
    (j) => j.state === 'opened',
  ).length
  const failedJobs = aiMl.anomalyJobs.filter(
    (j) => j.state === 'failed',
  ).length
  const closedJobs = aiMl.anomalyJobs.filter(
    (j) => j.state === 'closed',
  ).length

  const aiAssistantLabel =
    aiFeatures.hasSecurityAiAssistant && aiFeatures.hasObservabilityAiAssistant
      ? 'Security + Observability'
      : aiFeatures.hasSecurityAiAssistant
        ? 'Security'
        : aiFeatures.hasObservabilityAiAssistant
          ? 'Observability'
          : null

  return (
    <div>
      {/* Status badge */}
      <div style={{ marginBottom: 12 }}>
        <EuiBadge color={status.color}>{status.label}</EuiBadge>
      </div>

      {/* Stat cards */}
      <EuiFlexGroup gutterSize="m" wrap style={{ marginBottom: 16 }}>
        <EuiFlexItem grow={false} style={{ minWidth: 130 }}>
          <EuiPanel paddingSize="m">
            <EuiStat
              title={
                aiMl.upgradeMode
                  ? 'Upgrade Mode'
                  : aiMl.mlEnabled
                    ? 'Enabled'
                    : 'Disabled'
              }
              description="ML Status"
              titleColor={
                aiMl.upgradeMode
                  ? 'warning'
                  : aiMl.mlEnabled
                    ? 'success'
                    : 'subdued'
              }
              titleSize="s"
            />
          </EuiPanel>
        </EuiFlexItem>
        {aiMl.anomalyJobs.length > 0 && (
          <EuiFlexItem grow={false} style={{ minWidth: 130 }}>
            <EuiPanel paddingSize="m">
              <EuiStat
                title={aiMl.anomalyJobs.length}
                description="Anomaly Jobs"
                titleSize="s"
              />
              <EuiText size="xs" color="subdued" style={{ marginTop: 4 }}>
                {openedJobs > 0 && (
                  <EuiText size="xs" color="success" component="span">{openedJobs} opened</EuiText>
                )}
                {openedJobs > 0 && failedJobs > 0 && ' · '}
                {failedJobs > 0 && (
                  <EuiText size="xs" color="danger" component="span">{failedJobs} failed</EuiText>
                )}
                {closedJobs > 0 &&
                  (openedJobs > 0 || failedJobs > 0) &&
                  ` · ${closedJobs} closed`}
                {closedJobs > 0 &&
                  openedJobs === 0 &&
                  failedJobs === 0 &&
                  `${closedJobs} closed`}
              </EuiText>
            </EuiPanel>
          </EuiFlexItem>
        )}
        {nonTrivialModels.length > 0 && (
          <EuiFlexItem grow={false} style={{ minWidth: 130 }}>
            <EuiPanel paddingSize="m">
              <EuiStat
                title={nonTrivialModels.length}
                description="NLP Models"
                titleColor="primary"
                titleSize="s"
              />
              <EuiText size="xs" color="subdued" style={{ marginTop: 4 }}>
                {nonTrivialModels.map((m) => modelClassLabel(m)).join(' · ')}
              </EuiText>
            </EuiPanel>
          </EuiFlexItem>
        )}
        {features && features.semanticTextIndexCount > 0 && (
          <EuiFlexItem grow={false} style={{ minWidth: 130 }}>
            <EuiPanel paddingSize="m">
              <EuiStat
                title={features.semanticTextIndexCount}
                description="Semantic Indices"
                titleColor="primary"
                titleSize="s"
              />
              <EuiText size="xs" color="subdued" style={{ marginTop: 4 }}>
                semantic_text fields
              </EuiText>
            </EuiPanel>
          </EuiFlexItem>
        )}
        {activeInferenceEndpoints.length > 0 && (
          <EuiFlexItem grow={false} style={{ minWidth: 130 }}>
            <EuiPanel paddingSize="m">
              <EuiStat
                title={activeInferenceEndpoints.length}
                description="Inference Endpoints"
                titleColor="primary"
                titleSize="s"
              />
              <EuiText size="xs" color="subdued" style={{ marginTop: 4 }}>
                referenced in mappings / pipelines
              </EuiText>
            </EuiPanel>
          </EuiFlexItem>
        )}
        {aiAssistantLabel && (
          <EuiFlexItem grow={false} style={{ minWidth: 130 }}>
            <EuiPanel paddingSize="m">
              <EuiStat
                title="Active"
                description="AI Agent"
                titleColor="success"
                titleSize="s"
              />
              <EuiText size="xs" color="subdued" style={{ marginTop: 4 }}>
                {aiAssistantLabel}
              </EuiText>
            </EuiPanel>
          </EuiFlexItem>
        )}
      </EuiFlexGroup>

      {/* Detail panels */}
      {aiMl.anomalyJobs.length > 0 && (
        <>
          <AnomalyDetectionPanel jobs={aiMl.anomalyJobs} />
          <EuiSpacer size="m" />
        </>
      )}
      {aiMl.trainedModels.length > 0 && (
        <>
          <TrainedModelsPanel models={aiMl.trainedModels} />
          <EuiSpacer size="m" />
        </>
      )}
      {aiMl.dfaJobs.length > 0 && (
        <>
          <DFAPanel jobs={aiMl.dfaJobs} />
          <EuiSpacer size="m" />
        </>
      )}
      {mlNodes.length > 0 && (
        <>
          <MLMemoryPanel nodes={mlNodes} />
          <EuiSpacer size="m" />
        </>
      )}
      {showSemanticPanel && features && (
        <>
          <SemanticSearchPanel features={features} />
          <EuiSpacer size="m" />
        </>
      )}
      {showAiFeaturesPanel && (
        <AIFeaturesPanel aiMl={aiMl} features={features} />
      )}
    </div>
  )
}
