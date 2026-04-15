import { useState, useMemo } from 'react'
import {
  EuiBasicTable,
  EuiButtonEmpty,
  EuiDescriptionList,
  EuiFlexGroup,
  EuiFlexItem,
  EuiPanel,
  EuiBadge,
  EuiSpacer,
  EuiTitle,
  EuiToolTip,
  type EuiBasicTableColumn,
  type Criteria,
} from '@elastic/eui'
import type { ClusterStats, ILMInfo, ILMPolicyDetail, SnapshotInfo, SizingMetrics } from '../parsers/types'
import { formatBytes, formatCount } from '../utils/format'

interface Props {
  stats: ClusterStats | null
  ilm: ILMInfo | null
  snapshots: SnapshotInfo | null
  sizing: SizingMetrics | null
  tierStorage: Record<string, number> | null
}

const ILM_PAGE_SIZE_OPTIONS = [10, 20, 50]
const ILM_DEFAULT_PAGE_SIZE = 10

export function ILMPoliciesTable({ policies }: { policies: ILMPolicyDetail[] }) {
  const [showSystem, setShowSystem] = useState(false)
  const [showEmpty, setShowEmpty] = useState(false)
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(ILM_DEFAULT_PAGE_SIZE)

  const filtered = useMemo(() => {
    let result = policies
    if (!showSystem) result = result.filter(p => !p.name.startsWith('.'))
    if (!showEmpty) result = result.filter(p => p.indexCount > 0)
    return result
  }, [policies, showSystem, showEmpty])

  const displayed = useMemo(() => {
    const start = pageIndex * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, pageIndex, pageSize])

  const columns: EuiBasicTableColumn<ILMPolicyDetail>[] = [
    {
      field: 'name',
      name: 'Policy',
      truncateText: true,
      render: (name: string) => (
        <EuiToolTip content={name}>
          <span
            style={{
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: '0.85em',
            }}
          >
            {name}
          </span>
        </EuiToolTip>
      ),
    },
    {
      field: 'deleteDays',
      name: 'Delete',
      width: '80px',
      align: 'right' as const,
      render: (v: number | null) =>
        v !== null ? `${Math.round(v)}d` : <span style={{ color: 'var(--euiColorSubduedText)' }}>—</span>,
    },
    {
      field: 'hotMaxAge',
      name: 'Hot rollover',
      width: '110px',
      align: 'right' as const,
      render: (age: string | null, item: ILMPolicyDetail) => {
        if (!age && !item.hotMaxSize) return <span style={{ color: 'var(--euiColorSubduedText)' }}>—</span>
        const parts = [age, item.hotMaxSize].filter(Boolean)
        return <span style={{ fontSize: '0.85em' }}>{parts.join(' / ')}</span>
      },
    },
    {
      field: 'warmMinAge',
      name: 'Warm',
      width: '75px',
      align: 'right' as const,
      render: (v: string | null) =>
        v ?? <span style={{ color: 'var(--euiColorSubduedText)' }}>—</span>,
    },
    {
      field: 'coldMinAge',
      name: 'Cold',
      width: '75px',
      align: 'right' as const,
      render: (v: string | null) =>
        v ?? <span style={{ color: 'var(--euiColorSubduedText)' }}>—</span>,
    },
    {
      field: 'forceMergeSegments',
      name: 'Force merge',
      width: '100px',
      align: 'right' as const,
      render: (v: number | null) =>
        v !== null ? `${v} seg` : <span style={{ color: 'var(--euiColorSubduedText)' }}>—</span>,
    },
    {
      field: 'shrinkShards',
      name: 'Shrink',
      width: '75px',
      align: 'right' as const,
      render: (v: number | null) =>
        v !== null ? `${v} shards` : <span style={{ color: 'var(--euiColorSubduedText)' }}>—</span>,
    },
    {
      field: 'indexCount',
      name: 'Indices',
      width: '75px',
      align: 'right' as const,
      render: (v: number) =>
        v > 0
          ? String(v)
          : <span style={{ color: 'var(--euiColorSubduedText)' }}>0</span>,
    },
  ]

  const pagination = {
    pageIndex,
    pageSize,
    totalItemCount: filtered.length,
    pageSizeOptions: ILM_PAGE_SIZE_OPTIONS,
  }

  function onTableChange({ page: newPage }: Criteria<ILMPolicyDetail>) {
    if (newPage) {
      setPageIndex(newPage.index)
      setPageSize(newPage.size)
    }
  }

  return (
    <div>
      <EuiFlexGroup justifyContent="flexEnd" gutterSize="s" responsive={false}>
        <EuiFlexItem grow={false}>
          <EuiButtonEmpty
            size="s"
            onClick={() => { setShowEmpty(v => !v); setPageIndex(0) }}
            iconType={showEmpty ? 'eye' : 'eyeClosed'}
          >
            {showEmpty ? 'Hide unused policies' : 'Show unused policies'}
          </EuiButtonEmpty>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiButtonEmpty
            size="s"
            onClick={() => { setShowSystem(v => !v); setPageIndex(0) }}
            iconType={showSystem ? 'eye' : 'eyeClosed'}
          >
            {showSystem ? 'Hide system policies' : 'Show system policies'}
          </EuiButtonEmpty>
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiBasicTable
        items={displayed}
        columns={columns}
        pagination={pagination}
        onChange={onTableChange}
      />
    </div>
  )
}

export default function DataProfile({ stats, ilm, snapshots, sizing, tierStorage }: Props) {
  const hasStats = stats !== null
  const hasIlm = ilm !== null || (tierStorage !== null && Object.keys(tierStorage).length > 0)
  const hasSnapshots = snapshots !== null
  const hasSizing = sizing !== null && (
    sizing.avgQueryRateQPS !== null ||
    sizing.ingestRateGBPerDay !== null
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
                  ...(sizing.avgQueryRateQPS !== null ? [{
                    title: 'Avg query rate',
                    description: `~${Math.round(sizing.avgQueryRateQPS).toLocaleString()} QPS${sizing.nodeUptimeDays !== null ? ` (avg since last restart, ${sizing.nodeUptimeDays.toFixed(1)}d ago)` : ''}`,
                  }] : []),
                  ...(sizing.ingestRateGBPerDay !== null ? [{
                    title: 'Est. avg ingest rate',
                    description: `~${sizing.ingestRateGBPerDay.toFixed(1)} GB/day (compressed primary, retention-based avg — not peak)`,
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
