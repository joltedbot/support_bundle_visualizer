import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiBadge,
  EuiText,
  EuiPanel,
  EuiSpacer,
  EuiBasicTable,
} from '@elastic/eui'
import type { ReplicationInfo } from '../parsers/types'

interface Props {
  replication: ReplicationInfo | null
}

export default function CrossCluster({ replication }: Props) {
  if (!replication) return null

  const {
    hasCCR,
    followerIndexCount,
    remoteClusterCount,
    remoteClusterNames,
    remoteClusters,
    followerIndices,
    autoFollowPatterns,
  } = replication

  if (!hasCCR && remoteClusterCount === 0) return null

  const remoteColumns = [
    {
      field: 'name',
      name: 'Cluster Name',
      render: (name: string) => <strong>{name}</strong>,
    },
    {
      field: 'mode',
      name: 'Mode',
      render: (mode: string) => <EuiBadge color="hollow">{mode}</EuiBadge>,
    },
    {
      field: 'connected',
      name: 'Connected',
      render: (connected: boolean) => (
        <EuiBadge color={connected ? 'success' : 'danger'}>
          {connected ? 'CONNECTED' : 'DISCONNECTED'}
        </EuiBadge>
      ),
    },
    {
      field: 'proxyAddress',
      name: 'Proxy Address',
      render: (addr: string | null) => addr || '—',
    },
    {
      field: 'skipUnavailable',
      name: 'Skip Unavailable',
      render: (skip: boolean) => (skip ? 'Yes' : 'No'),
    },
  ]

  const followerColumns = [
    {
      field: 'followerIndex',
      name: 'Follower Index',
      render: (name: string) => <strong>{name}</strong>,
    },
    {
      field: 'leaderIndex',
      name: 'Leader Index',
    },
    {
      field: 'remoteCluster',
      name: 'Remote Cluster',
      render: (name: string) => <EuiBadge color="hollow">{name}</EuiBadge>,
    },
    {
      field: 'status',
      name: 'Status',
      render: (status: string) => (
        <EuiBadge color={status === 'active' ? 'success' : 'warning'}>{status}</EuiBadge>
      ),
    },
  ]

  const autoFollowColumns = [
    {
      field: 'name',
      name: 'Pattern Name',
      render: (name: string) => <strong>{name}</strong>,
    },
    {
      field: 'remoteCluster',
      name: 'Remote Cluster',
      render: (name: string) => <EuiBadge color="hollow">{name}</EuiBadge>,
    },
    {
      field: 'leaderIndexPatterns',
      name: 'Leader Patterns',
      render: (patterns: string[]) => patterns.join(', '),
    },
    {
      field: 'followIndexPattern',
      name: 'Follow Pattern',
    },
  ]

  return (
    <div>
      <EuiFlexGroup gutterSize="m" wrap responsive={false}>
        {hasCCR && (
          <EuiFlexItem grow={false}>
            <EuiPanel paddingSize="m" style={{ minWidth: 200 }}>
              <EuiText size="xs" color="subdued">Cross-Cluster Replication (CCR)</EuiText>
              <EuiSpacer size="xs" />
              <EuiText size="s">
                <strong>{followerIndexCount}</strong>{' '}
                <span style={{ color: 'var(--euiColorSubduedText)' }}>
                  follower {followerIndexCount === 1 ? 'index' : 'indices'}
                </span>
              </EuiText>
            </EuiPanel>
          </EuiFlexItem>
        )}

        {remoteClusterCount > 0 && (
          <EuiFlexItem grow={false}>
            <EuiPanel paddingSize="m" style={{ minWidth: 200 }}>
              <EuiText size="xs" color="subdued">
                Remote Clusters / CCS ({remoteClusterCount})
              </EuiText>
              <EuiSpacer size="xs" />
              <EuiFlexGroup gutterSize="xs" wrap responsive={false}>
                {remoteClusterNames.map(name => (
                  <EuiFlexItem key={name} grow={false}>
                    <EuiBadge color="hollow">{name}</EuiBadge>
                  </EuiFlexItem>
                ))}
              </EuiFlexGroup>
            </EuiPanel>
          </EuiFlexItem>
        )}
      </EuiFlexGroup>

      {remoteClusters.length > 0 && (
        <>
          <EuiSpacer size="l" />
          <EuiPanel paddingSize="m">
            <EuiText size="s" style={{ marginBottom: 12 }}><strong>Remote Clusters</strong></EuiText>
            <EuiBasicTable
              items={remoteClusters}
              columns={remoteColumns}
            />
          </EuiPanel>
        </>
      )}

      {followerIndices.length > 0 && (
        <>
          <EuiSpacer size="l" />
          <EuiPanel paddingSize="m">
            <EuiText size="s" style={{ marginBottom: 12 }}><strong>Follower Indices</strong></EuiText>
            <EuiBasicTable
              items={followerIndices}
              columns={followerColumns}
            />
          </EuiPanel>
        </>
      )}

      {autoFollowPatterns.length > 0 && (
        <>
          <EuiSpacer size="l" />
          <EuiPanel paddingSize="m">
            <EuiText size="s" style={{ marginBottom: 12 }}><strong>Auto-Follow Patterns</strong></EuiText>
            <EuiBasicTable
              items={autoFollowPatterns}
              columns={autoFollowColumns}
            />
          </EuiPanel>
        </>
      )}
    </div>
  )
}
