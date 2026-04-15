import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiBadge,
  EuiText,
  EuiPanel,
  EuiHorizontalRule,
} from '@elastic/eui'
import type { InternalHealth } from '../parsers/types'

interface Props {
  internalHealth: InternalHealth | null
}

const INDICATOR_LABELS: Record<string, string> = {
  master_is_stable: 'Master Stability',
  repository_integrity: 'Repository Integrity',
  disk: 'Disk Usage',
  shards_capacity: 'Shard Capacity',
  shards_availability: 'Shard Availability',
  slm: 'Snapshot Lifecycle (SLM)',
  ilm: 'Index Lifecycle (ILM)',
  data_stream_lifecycle: 'Data Stream Lifecycle',
  file_settings: 'File Settings',
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'green': return 'success'
    case 'yellow': return 'warning'
    case 'red': return 'danger'
    default: return 'subdued'
  }
}

export default function InternalHealthSection({ internalHealth }: Props) {
  if (!internalHealth) return null

  const { overallStatus, indicators } = internalHealth

  return (
    <EuiPanel paddingSize="m">
      <EuiFlexGroup alignItems="center" gutterSize="m">
        <EuiFlexItem grow={false}>
          <EuiText size="s"><strong>Internal Health Indicators</strong></EuiText>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiBadge color={getStatusColor(overallStatus)}>{overallStatus.toUpperCase()}</EuiBadge>
        </EuiFlexItem>
      </EuiFlexGroup>
      
      <EuiHorizontalRule margin="m" />

      <EuiFlexGroup wrap gutterSize="l" responsive={false}>
        {Object.entries(indicators).map(([key, indicator]) => (
          <EuiFlexItem key={key} grow={false} style={{ minWidth: 200, marginBottom: 12 }}>
            <EuiText size="xs" color="subdued">
              {INDICATOR_LABELS[key] || key.replace(/_/g, ' ')}
            </EuiText>
            <div style={{ marginTop: 4, marginBottom: 4 }}>
              <EuiBadge color={getStatusColor(indicator.status)} style={{ minWidth: 60 }}>
                {indicator.status.toUpperCase()}
              </EuiBadge>
            </div>
            {indicator.symptom && (
              <EuiText size="xs" style={{ marginTop: 4 }}>
                {indicator.symptom}
              </EuiText>
            )}
            {indicator.status !== 'green' && indicator.details && (
              <EuiText size="xs" color="subdued" style={{ marginTop: 4 }}>
                {Object.entries(indicator.details)
                  .filter(([, v]) => v !== null && v !== 0 && v !== false)
                  .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
                  .join(' · ')}
              </EuiText>
            )}
          </EuiFlexItem>
        ))}
      </EuiFlexGroup>
    </EuiPanel>
  )
}
