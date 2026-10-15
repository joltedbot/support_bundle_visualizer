import {
  EuiFlexGroup,
  EuiPanel,
  EuiText,
  EuiTitle,
  EuiSpacer,
  EuiBadge,
  EuiBasicTable,
} from '@elastic/eui'
import type {
  AiMlInfo,
  FeatureInfo,
  DenseVectorDimGroup,
} from '../../parsers/types'
import { formatBytes, formatCount } from '../../utils/format'
import { getModelHint } from '../../utils/modelHints'
import { Pill, SubSection } from './shared'

export function AIFeaturesPanel({
  aiMl,
  features,
}: {
  aiMl: AiMlInfo
  features: FeatureInfo | null
}) {
  const { aiFeatures } = aiMl
  const activeEndpoints = features?.activeInferenceEndpoints ?? []
  const externalGroups =
    features?.denseVectorDimGroups.filter((g) => g.inferenceId === null) ?? []

  const externalColumns = [
    {
      field: 'dims' as const,
      name: 'Dimensions',
      render: (d: number) => (
        <EuiText size="s" color="primary" component="span"><strong>{d}</strong></EuiText>
      ),
    },
    {
      field: 'count' as const,
      name: 'Indices',
      render: (c: number) => formatCount(c),
    },
    {
      name: 'Likely Model',
      render: (g: DenseVectorDimGroup) => {
        const hint = getModelHint(g.dims)
        return hint ? (
          <EuiBadge color="hollow">{hint}</EuiBadge>
        ) : (
          <EuiText size="s" color="subdued" component="span">—</EuiText>
        )
      },
    },
  ]

  return (
    <EuiPanel paddingSize="m">
      <EuiTitle size="xs"><h3>AI Features Detected</h3></EuiTitle>
      <EuiSpacer size="s" />
      <EuiFlexGroup gutterSize="m" wrap>
        {(aiFeatures.hasSecurityAiAssistant ||
          aiFeatures.hasObservabilityAiAssistant) && (
          <SubSection title="AI Agents">
            {aiFeatures.hasSecurityAiAssistant && (
              <Pill
                dotColor="#36b37e"
                title="Security AI Assistant"
                subtitle=".kibana-elastic-ai-assistant-*"
              />
            )}
            {aiFeatures.hasObservabilityAiAssistant && (
              <Pill
                dotColor="#36b37e"
                title="Observability AI Assistant"
                subtitle={`.kibana-observability-ai-assistant-*${aiFeatures.observabilityConversationCount > 0 ? ` · ${formatCount(aiFeatures.observabilityConversationCount)} conversations` : ''}`}
              />
            )}
          </SubSection>
        )}

        {aiFeatures.hasChatAgents && (
          <SubSection title="Agent Builder">
            {aiFeatures.chatAgentCount > 0 && (
              <Pill
                dotColor="#4c9aff"
                title="Chat Agents"
                subtitle={`.chat-agents · ${formatCount(aiFeatures.chatAgentCount)} agents`}
              />
            )}
            {aiFeatures.chatConversationCount > 0 && (
              <Pill
                dotColor="#4c9aff"
                title="Conversations"
                subtitle={`.chat-conversations · ${formatCount(aiFeatures.chatConversationCount)}`}
              />
            )}
            {aiFeatures.chatToolCount > 0 && (
              <Pill
                dotColor="#4c9aff"
                title="Tool Definitions"
                subtitle={`.chat-tools · ${formatCount(aiFeatures.chatToolCount)} tools`}
              />
            )}
          </SubSection>
        )}

        {aiFeatures.hasProductDocIndices && (
          <SubSection title="AI Product Docs (KB)">
            <Pill
              dotColor="#4c9aff"
              title={`${aiFeatures.productDocIndexCount} product doc ${aiFeatures.productDocIndexCount === 1 ? 'index' : 'indices'}`}
              subtitle=".kibana_ai_product_doc_* · E5 embeddings"
            />
          </SubSection>
        )}

        {(activeEndpoints.length > 0 ||
          aiFeatures.mlInferenceStorageBytes > 0) && (
          <SubSection title="ELASTIC INFERENCE SERVICE">
            {activeEndpoints.map((id) => (
              <Pill
                key={id}
                dotColor="#4c9aff"
                title={id}
                subtitle="referenced in mappings / pipelines"
              />
            ))}
            {aiFeatures.mlInferenceStorageBytes > 0 && (
              <Pill
                dotColor="#4c9aff"
                title="ML inference storage"
                subtitle={`.ml-inference-native-* · ${formatBytes(aiFeatures.mlInferenceStorageBytes)}`}
              />
            )}
          </SubSection>
        )}
      </EuiFlexGroup>

      {externalGroups.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <EuiTitle size="xxs"><h4>External Models</h4></EuiTitle>
          <EuiSpacer size="s" />
          <EuiBasicTable
            items={externalGroups}
            columns={externalColumns}
            tableLayout="auto"
          />
        </div>
      )}
    </EuiPanel>
  )
}
