import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiPanel,
  EuiText,
  EuiTitle,
  EuiSpacer,
  EuiBadge,
  EuiBasicTable,
} from '@elastic/eui'
import type {
  TrainedModel,
} from '../../parsers/types'
import { formatCount } from '../../utils/format'
import { modelClassLabel, modelClassColor } from './labels'

export function TrainedModelsPanel({ models }: { models: TrainedModel[] }) {
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
          <EuiText size="s" color="subdued" component="span">—</EuiText>
        ),
    },
    {
      field: 'deploymentState' as const,
      name: 'Deployment',
      render: (s: string | null) =>
        s ? (
          <EuiBadge
            color={
              s === 'started'
                ? 'success'
                : s === 'failed'
                  ? 'danger'
                  : 'warning'
            }
          >
            {s}
          </EuiBadge>
        ) : (
          <EuiBadge color="hollow">not deployed</EuiBadge>
        ),
    },
    {
      name: 'Allocations',
      render: (m: TrainedModel) =>
        m.deploymentState
          ? `${m.allocationCount} / ${m.targetAllocationCount}`
          : '—',
    },
    {
      field: 'inferenceCount' as const,
      name: 'Inferences',
      render: (n: number) => (n > 0 ? formatCount(n) : '—'),
    },
    {
      field: 'avgInferenceTimeMs' as const,
      name: 'Avg Latency',
      render: (ms: number | null) =>
        ms !== null ? `${Math.round(ms)} ms` : '—',
    },
  ]

  return (
    <EuiPanel paddingSize="m">
      <EuiFlexGroup
        justifyContent="spaceBetween"
        alignItems="center"
        gutterSize="s"
      >
        <EuiFlexItem grow={false}>
          <EuiTitle size="xs"><h3>Trained Models &amp; NLP Deployments</h3></EuiTitle>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiBadge color="hollow">
            {models.length} model{models.length !== 1 ? 's' : ''}
          </EuiBadge>
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiSpacer size="s" />
      <EuiBasicTable items={models} columns={columns} tableLayout="auto" />
    </EuiPanel>
  )
}
