import {
  EuiDescriptionList,
  EuiFlexGroup,
  EuiFlexItem,
  EuiPanel,
  EuiBadge,
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
  tierStorage: Record<string, number> | null
}

export default function DataProfile({ stats, ilm, snapshots, sizing, tierStorage }: Props) {
  const hasStats = stats !== null
  const hasIlm = ilm !== null || (tierStorage !== null && Object.keys(tierStorage).length > 0)
  const hasSnapshots = snapshots !== null
  const hasSizing = sizing !== null && (
    sizing.avgQueryRateQPS !== null ||
    sizing.ingestRateGBPerDay !== null ||
    sizing.bulkIngestRateBytesPerDay !== null ||
    (sizing.ilmWindowRates !== null && (
      sizing.ilmWindowRates.bulkBytesPerDay > 0 ||
      sizing.ilmWindowRates.indexingBytesPerDay > 0 ||
      sizing.ilmWindowRates.compressionRatio !== null
    ))
  )
  if (!hasStats && !hasIlm && !hasSnapshots && !hasSizing) return null

  return (
    <>
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

        {hasIlm && (() => {
          const TIER_ORDER = ['hot', 'warm', 'cold', 'frozen', 'master', 'coordinating', 'mixed'] as const
          const tierItems: { title: string; description: string }[] = []

          // ILM summary rows
          if (ilm) {
            tierItems.push({ title: 'ILM policies', description: String(ilm.policyCount) })
            tierItems.push({ title: 'Managed indices', description: String(ilm.managedIndexCount) })
          }

          // Tier rows: combine ILM index counts with shard-based storage
          const ilmTiers = ilm?.tiers ?? { hot: 0, warm: 0, cold: 0, frozen: 0 }
          const TIER_LABELS: Record<string, string> = {
            hot: 'Hot', warm: 'Warm', cold: 'Cold', frozen: 'Frozen',
            master: 'Master', coordinating: 'Coordinating', mixed: 'Mixed',
          }

          for (const tier of TIER_ORDER) {
            const indexCount = (ilmTiers as Record<string, number>)[tier] ?? 0
            const storageBytes = tierStorage?.[tier] ?? 0
            // Show row if either ILM has indices or tier has storage
            if (indexCount > 0 || storageBytes > 0) {
              const label = `${TIER_LABELS[tier] ?? tier}`
              const parts: string[] = []
              if (indexCount > 0) parts.push(`${indexCount} managed indices`)
              if (storageBytes > 0) parts.push(formatBytes(storageBytes))
              tierItems.push({ title: label, description: parts.join(' · ') })
            }
          }

          return (
            <EuiFlexItem grow={false} style={{ minWidth: 240 }}>
              <EuiPanel paddingSize="m">
                <EuiTitle size="xs"><h4>ILM & Tiering</h4></EuiTitle>
                <EuiSpacer size="s" />
                <EuiDescriptionList
                  compressed
                  listItems={tierItems}
                />
              </EuiPanel>
            </EuiFlexItem>
          )
        })()}

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
                  ...(sizing.ilmWindowRates !== null && sizing.ilmWindowRates.bulkBytesPerDay > 0 ? [{
                    title: 'Est. bulk ingest rate (ILM window)',
                    description: `~${formatBytes(sizing.ilmWindowRates.bulkBytesPerDay)}/day — raw pre-compression bytes through the Bulk API, measured over each write index's own ILM write window (${sizing.ilmWindowRates.writeIndexCount} write ${sizing.ilmWindowRates.writeIndexCount === 1 ? 'index' : 'indices'}).`,
                  }] : []),
                  ...(sizing.ilmWindowRates !== null && sizing.ilmWindowRates.indexingBytesPerDay > 0 ? [{
                    title: 'Est. on-disk growth (ILM window)',
                    description: `~${formatBytes(sizing.ilmWindowRates.indexingBytesPerDay)}/day — primary shard growth after compression; use for storage and retention planning.`,
                  }] : []),
                  ...(sizing.ilmWindowRates?.compressionRatio != null ? [{
                    title: 'Effective compression ratio',
                    description: `${sizing.ilmWindowRates.compressionRatio.toFixed(1)}:1 (logsdb typically 10:1–20:1, standard 2:1–5:1; near 1:1 means compression is not working).`,
                  }] : []),
                  ...(sizing.primaryRetentionDays !== null ? [{
                    title: 'Est. data retention',
                    description: `~${sizing.primaryRetentionDays} days (modal ILM delete phase across all managed policies)`,
                  }] : []),
                  ...(sizing.avgQueryRateQPS !== null ? [{
                    title: 'Avg query rate',
                    description: `~${Math.round(sizing.avgQueryRateQPS).toLocaleString()} QPS${sizing.nodeUptimeDays !== null ? ` (avg since last restart, ${sizing.nodeUptimeDays.toFixed(1)}d ago)` : ''}`,
                  }] : []),
                  ...(sizing.ingestRateGBPerDay !== null ? [{
                    title: 'Est. avg ingest rate',
                    description: `~${sizing.ingestRateGBPerDay.toFixed(1)} GB/day (compressed primary, retention-based avg — not peak)`,
                  }] : []),
                  ...(sizing.bulkIngestRateBytesPerDay !== null ? [{
                    title: 'Est. avg indexed rate',
                    description: `~${formatBytes(sizing.bulkIngestRateBytesPerDay)}/day — cumulative _source bytes written to primary shards via bulk API ÷ node uptime${sizing.nodeUptimeDays !== null ? ` (${sizing.nodeUptimeDays.toFixed(1)}d)` : ''}. After ingest pipelines; excludes replicas and raw HTTP overhead.`,
                  }] : []),
                ]}
              />
            </EuiPanel>
          </EuiFlexItem>
        )}
      </EuiFlexGroup>

    </>
  )
}
