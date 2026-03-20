import {
  EuiDescriptionList,
  EuiFlexGroup,
  EuiFlexItem,
  EuiPanel,
  EuiBadge,
  EuiText,
  EuiSpacer,
  EuiTitle,
} from '@elastic/eui'
import type { ClusterStats, ILMInfo, SnapshotInfo, SizingMetrics } from '../parsers/types'
import { formatBytes, formatCount } from '../utils/format'

interface Props {
  stats: ClusterStats | null
  ilm: ILMInfo | null
  snapshots: SnapshotInfo | null
  sizing: SizingMetrics | null
}

export default function DataProfile({ stats, ilm, snapshots, sizing }: Props) {
  const hasStats = stats !== null
  const hasIlm = ilm !== null
  const hasSnapshots = snapshots !== null
  const hasSizing = sizing !== null && (
    sizing.avgQueryRateQPS !== null ||
    sizing.ingestRateGBPerDay !== null ||
    sizing.retentionDistribution.length > 0
  )

  if (!hasStats && !hasIlm && !hasSnapshots && !hasSizing) return null

  return (
    <EuiFlexGroup wrap gutterSize="l" alignItems="flexStart" responsive={false}>
      {hasStats && (
        <EuiFlexItem grow={false} style={{ minWidth: 280 }}>
          <EuiPanel paddingSize="m">
            <EuiTitle size="xs"><h4>Data Profile</h4></EuiTitle>
            <EuiSpacer size="s" />
            <EuiDescriptionList
              compressed
              listItems={[
                {
                  title: 'Total store size',
                  description: formatBytes(stats.totalStoreSizeBytes),
                },
                {
                  title: 'Total documents',
                  description: formatCount(stats.totalDocCount),
                },
                {
                  title: 'Avg document size',
                  description: formatBytes(stats.avgDocSizeBytes),
                },
                {
                  title: 'Lifetime query count',
                  description: formatCount(stats.searchQueryTotal),
                },
                {
                  title: 'Field data cache',
                  description: formatBytes(stats.fieldDataSizeBytes),
                },
                {
                  title: 'Segment count',
                  description: String(stats.segmentCount),
                },
              ]}
            />
          </EuiPanel>
        </EuiFlexItem>
      )}

      {hasIlm && (
        <EuiFlexItem grow={false} style={{ minWidth: 240 }}>
          <EuiPanel paddingSize="m">
            <EuiTitle size="xs"><h4>ILM & Tiering</h4></EuiTitle>
            <EuiSpacer size="s" />
            <EuiDescriptionList
              compressed
              listItems={[
                {
                  title: 'ILM policies',
                  description: String(ilm.policyCount),
                },
                {
                  title: 'Managed indices',
                  description: String(ilm.managedIndexCount),
                },
                {
                  title: 'Hot indices',
                  description: String(ilm.tiers.hot),
                },
                {
                  title: 'Warm indices',
                  description: String(ilm.tiers.warm),
                },
                {
                  title: 'Cold indices',
                  description: String(ilm.tiers.cold),
                },
                {
                  title: 'Frozen indices',
                  description: String(ilm.tiers.frozen),
                },
              ]}
            />
          </EuiPanel>
        </EuiFlexItem>
      )}

      {hasSnapshots && (
        <EuiFlexItem grow={false} style={{ minWidth: 240 }}>
          <EuiPanel paddingSize="m">
            <EuiTitle size="xs"><h4>Snapshots</h4></EuiTitle>
            <EuiSpacer size="s" />
            <EuiDescriptionList
              compressed
              listItems={[
                {
                  title: 'SLM policies',
                  description: String(snapshots.slmPolicyCount),
                },
              ]}
            />
            {snapshots.repositoryNames.length > 0 && (
              <>
                <EuiSpacer size="xs" />
                <EuiText size="xs" color="subdued">Repositories</EuiText>
                <EuiSpacer size="xs" />
                <EuiFlexGroup wrap gutterSize="xs" responsive={false}>
                  {snapshots.repositoryNames.map((repo) => (
                    <EuiFlexItem key={repo} grow={false}>
                      <EuiBadge color="hollow">{repo}</EuiBadge>
                    </EuiFlexItem>
                  ))}
                </EuiFlexGroup>
              </>
            )}
          </EuiPanel>
        </EuiFlexItem>
      )}

      {hasSizing && sizing && (
        <EuiFlexItem grow={false} style={{ minWidth: 280 }}>
          <EuiPanel paddingSize="m">
            <EuiTitle size="xs"><h4>Sizing Estimates</h4></EuiTitle>
            <EuiSpacer size="s" />
            <EuiDescriptionList
              compressed
              listItems={[
                ...(sizing.avgQueryRateQPS !== null ? [{
                  title: 'Avg query rate',
                  description: `~${Math.round(sizing.avgQueryRateQPS).toLocaleString()} QPS${sizing.nodeUptimeDays !== null ? ` (avg since last restart, ${sizing.nodeUptimeDays.toFixed(1)}d ago)` : ''}`,
                }] : []),
                ...(sizing.ingestRateGBPerDay !== null ? [{
                  title: 'Est. ingest rate',
                  description: `~${sizing.ingestRateGBPerDay.toFixed(1)} GB/day ingested (stored, estimate)`,
                }] : []),
              ]}
            />
            {sizing.retentionDistribution.length > 0 && (
              <>
                <EuiSpacer size="xs" />
                <EuiText size="xs" color="subdued">Data retention</EuiText>
                <EuiSpacer size="xs" />
                <EuiFlexGroup wrap gutterSize="xs" responsive={false}>
                  {sizing.retentionDistribution.map((b) => (
                    <EuiFlexItem key={b.days} grow={false}>
                      <EuiBadge color={b.days === sizing.primaryRetentionDays ? 'primary' : 'hollow'}>
                        {b.days}d × {b.policyCount}
                      </EuiBadge>
                    </EuiFlexItem>
                  ))}
                </EuiFlexGroup>
              </>
            )}
          </EuiPanel>
        </EuiFlexItem>
      )}
    </EuiFlexGroup>
  )
}
