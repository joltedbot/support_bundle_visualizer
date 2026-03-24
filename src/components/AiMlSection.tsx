import React from 'react'
import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiPanel,
  EuiText,
  EuiSpacer,
  EuiBadge,
  EuiBasicTable,
  EuiCallOut,
} from '@elastic/eui'
import type { AiMlInfo, FeatureInfo, AnomalyJob, TrainedModel, DFAJob, MLNodeMemory } from '../parsers/types'
import { formatBytes, formatCount } from '../utils/format'

interface Props {
  aiMl: AiMlInfo
  features: FeatureInfo | null
}

// ── Guards and status ─────────────────────────────────────────────────────────

function significantModels(models: TrainedModel[]): TrainedModel[] {
  return models.filter(m => m.modelClass !== 'lang_ident')
}

function hasAnything(aiMl: AiMlInfo, features: FeatureInfo | null): boolean {
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

type StatusInfo = { label: string; hexColor: string }

function getStatus(aiMl: AiMlInfo, features: FeatureInfo | null): StatusInfo {
  const hasIssues =
    aiMl.anomalyJobs.some(j => j.state === 'failed' || j.memoryStatus === 'hard_limit') ||
    significantModels(aiMl.trainedModels).some(m => m.deploymentState === 'failed')
  if (hasIssues) return { label: 'Issues Detected', hexColor: '#ff5630' }

  const semanticCount =
    (features?.semanticTextIndexCount ?? 0) +
    (features?.denseVectorIndexCount ?? 0) +
    (features?.sparseVectorIndexCount ?? 0)
  const isActive =
    aiMl.anomalyJobs.some(j => j.state === 'opened') ||
    significantModels(aiMl.trainedModels).some(m => m.deployed) ||
    semanticCount > 0 ||
    aiMl.aiFeatures.hasSecurityAiAssistant ||
    aiMl.aiFeatures.hasObservabilityAiAssistant ||
    aiMl.aiFeatures.hasChatAgents
  if (isActive) return { label: 'Active', hexColor: '#36b37e' }

  return { label: 'Licensed', hexColor: '#69707d' }
}

// ── Label helpers ─────────────────────────────────────────────────────────────

function modelClassLabel(m: TrainedModel): string {
  const labels: Record<string, string> = { elser: 'ELSER', e5: 'E5', dfa: 'DFA Model', nlp: 'NLP' }
  return labels[m.modelClass] ?? 'Model'
}

function modelClassColor(m: TrainedModel): string {
  if (m.modelClass === 'dfa') return '#6c4a9e'
  return '#0071c2'
}

function stateColor(state: string): 'success' | 'danger' | 'warning' | 'default' {
  if (state === 'opened' || state === 'started') return 'success'
  if (state === 'failed') return 'danger'
  if (['opening', 'closing', 'starting', 'stopping'].includes(state)) return 'warning'
  return 'default'
}

function datafeedColor(
  datafeedState: string | null,
  jobState: string
): 'success' | 'danger' | 'default' {
  if (!datafeedState) return 'default'
  if (datafeedState === 'started') return 'success'
  if (datafeedState === 'stopped' && jobState === 'opened') return 'danger'
  return 'default'
}

function memoryStatusColor(status: string): 'success' | 'danger' | 'warning' | 'default' {
  if (status === 'ok') return 'success'
  if (status === 'hard_limit') return 'danger'
  if (status === 'soft_limit') return 'warning'
  return 'default'
}

function memBarColor(pct: number): string {
  if (pct >= 90) return '#ff5630'
  if (pct >= 75) return '#ffab00'
  return '#36b37e'
}

const PANEL_LABEL_STYLE: React.CSSProperties = {
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  color: '#98a2b3',
}

// ── Sub-panels ────────────────────────────────────────────────────────────────

function AnomalyDetectionPanel({ jobs }: { jobs: AnomalyJob[] }) {
  const criticalJobs = jobs.filter(
    j => j.state === 'failed' || j.memoryStatus === 'hard_limit' ||
      (j.state === 'opened' && j.datafeedState === 'stopped')
  )

  const columns = [
    {
      field: 'jobId' as const,
      name: 'Job ID',
      render: (id: string) => <code style={{ fontSize: 11 }}>{id}</code>,
    },
    {
      field: 'origin' as const,
      name: 'Origin',
      render: (o: string) => (
        <EuiBadge color="hollow">
          {o === 'security' ? 'Security' : o === 'observability' ? 'Observability' : 'User'}
        </EuiBadge>
      ),
    },
    {
      field: 'state' as const,
      name: 'State',
      render: (s: string) => <EuiBadge color={stateColor(s)}>{s}</EuiBadge>,
    },
    {
      name: 'Datafeed',
      render: (job: AnomalyJob) => (
        <EuiBadge color={datafeedColor(job.datafeedState, job.state)}>
          {job.datafeedState ?? 'unknown'}
        </EuiBadge>
      ),
    },
    {
      field: 'memoryStatus' as const,
      name: 'Memory',
      render: (s: string) => (
        <EuiBadge color={memoryStatusColor(s)}>{s.replace(/_/g, ' ')}</EuiBadge>
      ),
    },
    {
      field: 'modelBytes' as const,
      name: 'Model Size',
      render: (b: number) => (b > 0 ? formatBytes(b) : '—'),
    },
    {
      field: 'processedRecordCount' as const,
      name: 'Records',
      render: (n: number) => (n > 0 ? formatCount(n) : '—'),
    },
  ]

  return (
    <EuiPanel paddingSize="m">
      <EuiFlexGroup justifyContent="spaceBetween" alignItems="center" gutterSize="s" style={{ marginBottom: 12 }}>
        <EuiFlexItem grow={false}>
          <EuiText size="xs"><strong style={PANEL_LABEL_STYLE}>Anomaly Detection</strong></EuiText>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiBadge color="hollow">{jobs.length} job{jobs.length !== 1 ? 's' : ''}</EuiBadge>
        </EuiFlexItem>
      </EuiFlexGroup>

      {criticalJobs.map(job => {
        const isDanger = job.state === 'failed' || job.memoryStatus === 'hard_limit'
        let msg = ''
        if (job.state === 'failed') msg = 'Job failed.'
        else if (job.memoryStatus === 'hard_limit') msg = 'Job hit memory hard limit — model cannot grow further.'
        else msg = 'Job is opened but datafeed is stopped — no data flowing.'
        if (job.assignmentExplanation) {
          const t = job.assignmentExplanation.slice(0, 200)
          msg += ` ${t}${job.assignmentExplanation.length > 200 ? '…' : ''}`
        }
        return (
          <EuiCallOut key={job.jobId} color={isDanger ? 'danger' : 'warning'} size="s" style={{ marginBottom: 8 }}>
            <EuiText size="xs"><strong>{job.jobId}</strong> — {msg}</EuiText>
          </EuiCallOut>
        )
      })}

      <EuiBasicTable items={jobs} columns={columns} tableLayout="auto" />
    </EuiPanel>
  )
}

function TrainedModelsPanel({ models }: { models: TrainedModel[] }) {
  const columns = [
    {
      field: 'modelId' as const,
      name: 'Model',
      render: (id: string) => <code style={{ fontSize: 11 }}>{id}</code>,
    },
    {
      field: 'modelClass' as const,
      name: 'Type',
      render: (_: string, m: TrainedModel) => (
        <EuiBadge color={modelClassColor(m)}>{modelClassLabel(m)}</EuiBadge>
      ),
    },
    {
      field: 'inferenceTask' as const,
      name: 'Task',
      render: (t: string | null) =>
        t ? (
          <EuiBadge color="hollow">{t.replace(/_/g, ' ')}</EuiBadge>
        ) : (
          <span style={{ color: '#6b7694' }}>—</span>
        ),
    },
    {
      field: 'deploymentState' as const,
      name: 'Deployment',
      render: (s: string | null) =>
        s ? (
          <EuiBadge color={s === 'started' ? 'success' : s === 'failed' ? 'danger' : 'warning'}>{s}</EuiBadge>
        ) : (
          <EuiBadge color="hollow">not deployed</EuiBadge>
        ),
    },
    {
      name: 'Allocations',
      render: (m: TrainedModel) =>
        m.deploymentState ? `${m.allocationCount} / ${m.targetAllocationCount}` : '—',
    },
    {
      field: 'inferenceCount' as const,
      name: 'Inferences',
      render: (n: number) => (n > 0 ? formatCount(n) : '—'),
    },
    {
      field: 'avgInferenceTimeMs' as const,
      name: 'Avg Latency',
      render: (ms: number | null) => (ms !== null ? `${Math.round(ms)} ms` : '—'),
    },
  ]

  return (
    <EuiPanel paddingSize="m">
      <EuiFlexGroup justifyContent="spaceBetween" alignItems="center" gutterSize="s" style={{ marginBottom: 12 }}>
        <EuiFlexItem grow={false}>
          <EuiText size="xs">
            <strong style={PANEL_LABEL_STYLE}>Trained Models &amp; NLP Deployments</strong>
          </EuiText>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiBadge color="hollow">
            {models.length} model{models.length !== 1 ? 's' : ''} · lang_ident excluded
          </EuiBadge>
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiBasicTable items={models} columns={columns} tableLayout="auto" />
    </EuiPanel>
  )
}

function DFAPanel({ jobs }: { jobs: DFAJob[] }) {
  const columns = [
    {
      field: 'id' as const,
      name: 'Job ID',
      render: (id: string) => <code style={{ fontSize: 11 }}>{id}</code>,
    },
    {
      field: 'analysisType' as const,
      name: 'Type',
      render: (t: string) => <EuiBadge color="hollow">{t.replace(/_/g, ' ')}</EuiBadge>,
    },
    {
      field: 'state' as const,
      name: 'State',
      render: (s: string) => (
        <EuiBadge color={s === 'failed' ? 'danger' : s === 'stopped' ? 'default' : 'success'}>{s}</EuiBadge>
      ),
    },
  ]

  return (
    <EuiPanel paddingSize="m">
      <EuiFlexGroup justifyContent="spaceBetween" alignItems="center" gutterSize="s" style={{ marginBottom: 12 }}>
        <EuiFlexItem grow={false}>
          <EuiText size="xs"><strong style={PANEL_LABEL_STYLE}>Data Frame Analytics</strong></EuiText>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiBadge color="hollow">{jobs.length} job{jobs.length !== 1 ? 's' : ''}</EuiBadge>
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiBasicTable items={jobs} columns={columns} tableLayout="auto" />
    </EuiPanel>
  )
}

function MLMemoryPanel({ nodes }: { nodes: MLNodeMemory[] }) {
  return (
    <EuiPanel paddingSize="m">
      <EuiText size="xs" style={{ marginBottom: 12 }}>
        <strong style={PANEL_LABEL_STYLE}>ML Memory</strong>
      </EuiText>
      {nodes.map(node => {
        const usedBytes = node.anomalyDetectorsBytes + node.nativeInferenceBytes + node.dataFrameAnalyticsBytes
        const usedPct = Math.round((usedBytes / node.maxBytes) * 100)
        const adPct = (node.anomalyDetectorsBytes / node.maxBytes) * 100
        const infPct = (node.nativeInferenceBytes / node.maxBytes) * 100
        const dfaPct = (node.dataFrameAnalyticsBytes / node.maxBytes) * 100
        return (
          <div key={node.nodeName} style={{ marginBottom: 14 }}>
            <EuiFlexGroup justifyContent="spaceBetween" gutterSize="none" style={{ marginBottom: 4 }}>
              <EuiFlexItem grow={false}>
                <EuiText size="xs" color="subdued">{node.nodeName}</EuiText>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiText size="xs" style={{ color: memBarColor(usedPct) }}>
                  {usedPct}% — {formatBytes(usedBytes)} / {formatBytes(node.maxBytes)}
                </EuiText>
              </EuiFlexItem>
            </EuiFlexGroup>
            {/* Stacked bar: yellow=AD, blue=inference, purple=DFA */}
            <div style={{ height: 10, background: '#111827', borderRadius: 5, overflow: 'hidden', display: 'flex' }}>
              {adPct > 0 && <div style={{ width: `${adPct}%`, background: '#ffab00' }} title={`Anomaly detectors: ${formatBytes(node.anomalyDetectorsBytes)}`} />}
              {infPct > 0 && <div style={{ width: `${infPct}%`, background: '#4c9aff' }} title={`Native inference: ${formatBytes(node.nativeInferenceBytes)}`} />}
              {dfaPct > 0 && <div style={{ width: `${dfaPct}%`, background: '#a855f7' }} title={`Data frame analytics: ${formatBytes(node.dataFrameAnalyticsBytes)}`} />}
            </div>
          </div>
        )
      })}
      <EuiText size="xs" color="subdued" style={{ marginTop: 4 }}>
        Yellow = anomaly detectors · Blue = native inference · Purple = data frame analytics
      </EuiText>
    </EuiPanel>
  )
}

function SemanticSearchPanel({ features }: { features: FeatureInfo }) {
  const names = features.semanticTextIndexNames
  const visibleNames = names.slice(0, 5)
  const overflow = names.length - 5

  return (
    <EuiPanel paddingSize="m">
      <EuiText size="xs" style={{ marginBottom: 12 }}>
        <strong style={PANEL_LABEL_STYLE}>Semantic &amp; Vector Search</strong>
      </EuiText>
      <EuiFlexGroup gutterSize="m" wrap style={{ marginBottom: names.length > 0 ? 12 : 0 }}>
        {[
          { label: 'semantic_text indices', count: features.semanticTextIndexCount },
          { label: 'dense_vector indices', count: features.denseVectorIndexCount },
          { label: 'sparse_vector indices', count: features.sparseVectorIndexCount },
        ].map(({ label, count }) => (
          <EuiFlexItem key={label} grow={false}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: count > 0 ? '#4c9aff' : '#6b7694' }}>
                {count}
              </div>
              <EuiText size="xs" color="subdued">{label}</EuiText>
            </div>
          </EuiFlexItem>
        ))}
      </EuiFlexGroup>
      {visibleNames.length > 0 && (
        <EuiFlexGroup gutterSize="xs" wrap>
          {visibleNames.map(name => (
            <EuiFlexItem key={name} grow={false}>
              <EuiBadge color="hollow" style={{ fontSize: 10 }}>{name}</EuiBadge>
            </EuiFlexItem>
          ))}
          {overflow > 0 && (
            <EuiFlexItem grow={false}>
              <EuiBadge color="hollow" style={{ fontSize: 10, color: '#6b7694' }}>+ {overflow} more</EuiBadge>
            </EuiFlexItem>
          )}
        </EuiFlexGroup>
      )}
    </EuiPanel>
  )
}

function AIFeaturesPanel({ aiMl }: { aiMl: AiMlInfo }) {
  const { aiFeatures } = aiMl

  const Dot = ({ color }: { color: string }) => (
    <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: color, marginRight: 6, flexShrink: 0, marginTop: 3 }} />
  )

  const Pill = ({ dotColor, title, subtitle }: { dotColor: string; title: string; subtitle: string }) => (
    <div style={{ display: 'inline-flex', alignItems: 'flex-start', background: '#111827', border: '1px solid #2c3040', borderRadius: 4, padding: '5px 10px', fontSize: 11, color: '#c2c6d4', marginBottom: 6 }}>
      <Dot color={dotColor} />
      <div>
        <div>{title}</div>
        <div style={{ fontSize: 9, color: '#6b7694' }}>{subtitle}</div>
      </div>
    </div>
  )

  const SubSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <EuiFlexItem style={{ minWidth: 220 }}>
      <EuiText size="xs" color="subdued" style={{ textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
        <strong>{title}</strong>
      </EuiText>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {children}
      </div>
    </EuiFlexItem>
  )

  return (
    <EuiPanel paddingSize="m">
      <EuiText size="xs" style={{ marginBottom: 12 }}>
        <strong style={PANEL_LABEL_STYLE}>AI Features Detected</strong>
      </EuiText>
      <EuiFlexGroup gutterSize="m" wrap>
        {(aiFeatures.hasSecurityAiAssistant || aiFeatures.hasObservabilityAiAssistant) && (
          <SubSection title="AI Assistants">
            {aiFeatures.hasSecurityAiAssistant && (
              <Pill dotColor="#36b37e" title="Security AI Assistant" subtitle=".kibana-elastic-ai-assistant-*" />
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
              <Pill dotColor="#4c9aff" title="Chat Agents" subtitle={`.chat-agents · ${formatCount(aiFeatures.chatAgentCount)} agents`} />
            )}
            {aiFeatures.chatConversationCount > 0 && (
              <Pill dotColor="#4c9aff" title="Conversations" subtitle={`.chat-conversations · ${formatCount(aiFeatures.chatConversationCount)}`} />
            )}
            {aiFeatures.chatToolCount > 0 && (
              <Pill dotColor="#4c9aff" title="Tool Definitions" subtitle={`.chat-tools · ${formatCount(aiFeatures.chatToolCount)} tools`} />
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

        {(aiFeatures.inferenceEndpointCount > 0 || aiFeatures.mlInferenceStorageBytes > 0) && (
          <SubSection title="Inference System">
            {aiFeatures.inferenceEndpointCount > 0 && (
              <Pill dotColor="#4c9aff" title={`${formatCount(aiFeatures.inferenceEndpointCount)} inference endpoints`} subtitle=".inference index" />
            )}
            {aiFeatures.mlInferenceStorageBytes > 0 && (
              <Pill dotColor="#4c9aff" title="ML inference storage" subtitle={`.ml-inference-native-* · ${formatBytes(aiFeatures.mlInferenceStorageBytes)}`} />
            )}
          </SubSection>
        )}
      </EuiFlexGroup>
    </EuiPanel>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, valueColor }: { label: string; value: React.ReactNode; sub?: React.ReactNode; valueColor?: string }) {
  return (
    <EuiFlexItem grow={false} style={{ minWidth: 130 }}>
      <EuiPanel paddingSize="m" style={{ background: '#111827', border: '1px solid #2c3040' }}>
        <EuiText size="xs" color="subdued" style={{ textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
          {label}
        </EuiText>
        <div style={{ fontSize: 22, fontWeight: 700, color: valueColor ?? '#f0f1f5', lineHeight: 1 }}>
          {value}
        </div>
        {sub && (
          <EuiText size="xs" color="subdued" style={{ marginTop: 4 }}>
            {sub}
          </EuiText>
        )}
      </EuiPanel>
    </EuiFlexItem>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AiMlSection({ aiMl, features }: Props) {
  if (!hasAnything(aiMl, features)) return null

  const status = getStatus(aiMl, features)
  const nonTrivialModels = significantModels(aiMl.trainedModels)
  const mlNodes = aiMl.mlNodeMemory.filter(n => n.maxBytes > 0)

  const semanticCount =
    (features?.semanticTextIndexCount ?? 0) +
    (features?.denseVectorIndexCount ?? 0) +
    (features?.sparseVectorIndexCount ?? 0)

  const { aiFeatures } = aiMl
  const showSemanticPanel = semanticCount > 0
  const showAiFeaturesPanel =
    aiFeatures.hasSecurityAiAssistant ||
    aiFeatures.hasObservabilityAiAssistant ||
    aiFeatures.hasChatAgents ||
    aiFeatures.hasProductDocIndices ||
    aiFeatures.inferenceEndpointCount > 0 ||
    aiFeatures.mlInferenceStorageBytes > 0

  // Anomaly job breakdowns for stat card
  const openedJobs = aiMl.anomalyJobs.filter(j => j.state === 'opened').length
  const failedJobs = aiMl.anomalyJobs.filter(j => j.state === 'failed').length
  const closedJobs = aiMl.anomalyJobs.filter(j => j.state === 'closed').length

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
        <EuiBadge color={status.hexColor}>{status.label}</EuiBadge>
      </div>

      {/* Stat cards */}
      <EuiFlexGroup gutterSize="m" wrap style={{ marginBottom: 16 }}>
        <StatCard
          label="ML Status"
          value={aiMl.upgradeMode ? 'Upgrade Mode' : aiMl.mlEnabled ? 'Enabled' : 'Disabled'}
          valueColor={aiMl.upgradeMode ? '#ffab00' : aiMl.mlEnabled ? '#36b37e' : '#69707d'}
        />
        {aiMl.anomalyJobs.length > 0 && (
          <StatCard
            label="Anomaly Jobs"
            value={aiMl.anomalyJobs.length}
            sub={
              <>
                {openedJobs > 0 && <span style={{ color: '#36b37e' }}>{openedJobs} opened</span>}
                {openedJobs > 0 && failedJobs > 0 && ' · '}
                {failedJobs > 0 && <span style={{ color: '#ff5630' }}>{failedJobs} failed</span>}
                {closedJobs > 0 && (openedJobs > 0 || failedJobs > 0) && ` · ${closedJobs} closed`}
                {closedJobs > 0 && openedJobs === 0 && failedJobs === 0 && `${closedJobs} closed`}
              </>
            }
          />
        )}
        {nonTrivialModels.length > 0 && (
          <StatCard
            label="NLP Models"
            value={nonTrivialModels.length}
            valueColor="#4c9aff"
            sub={nonTrivialModels.map(m => modelClassLabel(m)).join(' · ')}
          />
        )}
        {features && features.semanticTextIndexCount > 0 && (
          <StatCard
            label="Semantic Indices"
            value={features.semanticTextIndexCount}
            valueColor="#4c9aff"
            sub="semantic_text fields"
          />
        )}
        {aiFeatures.inferenceEndpointCount > 0 && (
          <StatCard
            label="Inference Endpoints"
            value={aiFeatures.inferenceEndpointCount}
            valueColor="#4c9aff"
            sub="from .inference index"
          />
        )}
        {aiAssistantLabel && (
          <StatCard
            label="AI Assistant"
            value="Active"
            valueColor="#36b37e"
            sub={aiAssistantLabel}
          />
        )}
      </EuiFlexGroup>

      {/* Detail panels */}
      {aiMl.anomalyJobs.length > 0 && (
        <>
          <AnomalyDetectionPanel jobs={aiMl.anomalyJobs} />
          <EuiSpacer size="m" />
        </>
      )}
      {nonTrivialModels.length > 0 && (
        <>
          <TrainedModelsPanel models={nonTrivialModels} />
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
      {showAiFeaturesPanel && <AIFeaturesPanel aiMl={aiMl} />}
    </div>
  )
}
