import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiBadge,
  EuiText,
  EuiPanel,
  EuiSpacer,
} from '@elastic/eui'
import type { ReplicationInfo } from '../parsers/types'

interface Props {
  replication: ReplicationInfo | null
}

export default function CrossCluster({ replication }: Props) {
  if (!replication) return null

  const { hasCCR, followerIndexCount, remoteClusterCount, remoteClusterNames } = replication

  if (!hasCCR && remoteClusterCount === 0) return null

  return (
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
  )
}
