import { useMemo } from 'react'
import {
  EuiBadge,
  EuiBasicTable,
  EuiPanel,
  EuiSpacer,
  EuiText,
  EuiTitle,
  type EuiBasicTableColumn,
} from '@elastic/eui'
import type { AgentlessIntegration, IndexInfo, InferenceEndpoint, InferenceInventory, KibanaInfo } from '../parsers/types'
import { buildAgentlessIntegrations } from '../parsers/agentless'

interface Props {
  inference: InferenceInventory | null
  kibana: KibanaInfo | null
  indices: IndexInfo[]
}

const inferenceColumns: EuiBasicTableColumn<InferenceEndpoint>[] = [
  {
    field: 'id',
    name: 'Name',
    render: (id: string) => <strong>{id}</strong>,
  },
  {
    field: 'service',
    name: 'Origin',
    render: (service: string) => (service ? <EuiBadge color="hollow">{service}</EuiBadge> : null),
  },
  { field: 'taskType', name: 'Task type' },
  {
    field: 'inUse',
    name: 'Status',
    render: (inUse: boolean) => (
      <EuiBadge color={inUse ? 'success' : 'default'}>{inUse ? 'In use' : 'Not referenced'}</EuiBadge>
    ),
  },
]

const agentlessColumns: EuiBasicTableColumn<AgentlessIntegration>[] = [
  {
    field: 'name',
    name: 'Name',
    render: (name: string) => <strong>{name}</strong>,
  },
  {
    name: 'Origin',
    render: () => <EuiBadge color="hollow">Agentless Fleet</EuiBadge>,
  },
  {
    field: 'status',
    name: 'Status',
    render: (status: AgentlessIntegration['status']) => (
      <EuiBadge color={status === 'receiving' ? 'success' : 'default'}>
        {status === 'receiving' ? 'Receiving data' : 'Installed only'}
      </EuiBadge>
    ),
  },
  {
    field: 'agentsOnline',
    name: 'Agent status',
    render: (online: number | null) =>
      online === null ? null : (
        <EuiBadge color={online > 0 ? 'success' : 'warning'}>{online > 0 ? 'Online' : 'Offline'}</EuiBadge>
      ),
  },
]

export default function InferenceIntegrations({ inference, kibana, indices }: Props) {
  const agentless = useMemo(() => buildAgentlessIntegrations(kibana, indices), [kibana, indices])
  const endpoints = inference?.endpoints ?? []
  const builtInCount = inference?.builtInCount ?? 0

  // Silent UI: nothing to show means no heading and no placeholder
  if (endpoints.length === 0 && agentless.length === 0) return null

  return (
    <>
      <EuiSpacer size="l" />
      <EuiTitle size="s"><h3>Inference &amp; Agentless Integrations</h3></EuiTitle>
      <EuiSpacer size="s" />
      <EuiPanel paddingSize="m">
        {endpoints.length > 0 && (
          <>
            <EuiText size="s" style={{ marginBottom: 12 }}><strong>External Inference</strong></EuiText>
            <EuiBasicTable<InferenceEndpoint>
              items={endpoints}
              columns={inferenceColumns}
              tableCaption="Inference endpoints"
            />
            {builtInCount > 0 && (
              <EuiText size="xs" color="subdued">
                <p>{builtInCount} built-in Elastic-hosted endpoints are available and not listed.</p>
              </EuiText>
            )}
          </>
        )}
        {agentless.length > 0 && (
          <>
            {endpoints.length > 0 && <EuiSpacer size="l" />}
            <EuiText size="s" style={{ marginBottom: 12 }}><strong>Agentless Integrations</strong></EuiText>
            <EuiBasicTable<AgentlessIntegration>
              items={agentless}
              columns={agentlessColumns}
              tableCaption="Agentless integrations"
            />
          </>
        )}
      </EuiPanel>
    </>
  )
}
