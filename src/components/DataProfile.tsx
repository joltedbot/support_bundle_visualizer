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
import type { ClusterStats, ILMInfo, ILMPolicyDetail, SLMPolicyDetail, SnapshotInfo, SizingMetrics } from '../parsers/types'
import { formatBytes, formatCount } from '../utils/format'
import { parseMinAgeDays } from '../parsers/ilm'

interface Props {
  stats: ClusterStats | null
  ilm: ILMInfo | null
  snapshots: SnapshotInfo | null
  sizing: SizingMetrics | null
  tierStorage: Record<string, number> | null
}

const ILM_PAGE_SIZE_OPTIONS = [10, 20, 50]
const ILM_DEFAULT_PAGE_SIZE = 10
const SLM_PAGE_SIZE_OPTIONS = [10, 20, 50]
const SLM_DEFAULT_PAGE_SIZE = 10

// Shifts the ordered tier min_ages up one slot so each column shows how long
// data resides in that tier (skipping tiers that are not configured).
function computeShiftedTiers(policy: ILMPolicyDetail): { hot: string | null; warm: string | null; cold: string | null; frozen: string | null } {
  const available = [policy.warmMinAge, policy.coldMinAge, policy.frozenMinAge, policy.deleteMinAge]
    .filter((v): v is string => v !== null && v !== undefined)
  return {
    hot: available[0] ?? null,
    warm: available[1] ?? null,
    cold: available[2] ?? null,
    frozen: available[3] ?? null,
  }
}

interface ILMPolicyRow extends ILMPolicyDetail {
  hotDisplay: string | null
  warmDisplay: string | null
  coldDisplay: string | null
  frozenDisplay: string | null
  hotDays: number | null
  warmDays: number | null
  coldDays: number | null
  frozenDays: number | null
}

type ILMSortField = 'name' | 'indexCount' | 'forceMergeSegments' | 'shrinkShards' | 'hotDisplay' | 'warmDisplay' | 'coldDisplay' | 'frozenDisplay'

interface ILMSortState {
  field: ILMSortField
  direction: 'asc' | 'desc'
}

export function ILMPoliciesTable({ policies }: { policies: ILMPolicyDetail[] }) {
  const [showSystem, setShowSystem] = useState(false)
  const [showEmpty, setShowEmpty] = useState(false)
  const [sort, setSort] = useState<ILMSortState>({ field: 'indexCount', direction: 'desc' })
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(ILM_DEFAULT_PAGE_SIZE)

  const rows: ILMPolicyRow[] = useMemo(() => policies.map(p => {
    const shifted = computeShiftedTiers(p)
    return {
      ...p,
      hotDisplay: shifted.hot,
      warmDisplay: shifted.warm,
      coldDisplay: shifted.cold,
      frozenDisplay: shifted.frozen,
      hotDays: shifted.hot ? parseMinAgeDays(shifted.hot) : null,
      warmDays: shifted.warm ? parseMinAgeDays(shifted.warm) : null,
      coldDays: shifted.cold ? parseMinAgeDays(shifted.cold) : null,
      frozenDays: shifted.frozen ? parseMinAgeDays(shifted.frozen) : null,
    }
  }), [policies])

  const filtered = useMemo(() => {
    let result = rows
    if (!showSystem) result = result.filter(p => !p.name.startsWith('.'))
    if (!showEmpty) result = result.filter(p => p.indexCount > 0)
    return result
  }, [rows, showSystem, showEmpty])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const mult = sort.direction === 'asc' ? 1 : -1
      switch (sort.field) {
        case 'name': return a.name.localeCompare(b.name) * mult
        case 'indexCount': return (a.indexCount - b.indexCount) * mult
        case 'forceMergeSegments': return ((a.forceMergeSegments ?? -1) - (b.forceMergeSegments ?? -1)) * mult
        case 'shrinkShards': return ((a.shrinkShards ?? -1) - (b.shrinkShards ?? -1)) * mult
        case 'hotDisplay': return ((a.hotDays ?? -1) - (b.hotDays ?? -1)) * mult
        case 'warmDisplay': return ((a.warmDays ?? -1) - (b.warmDays ?? -1)) * mult
        case 'coldDisplay': return ((a.coldDays ?? -1) - (b.coldDays ?? -1)) * mult
        case 'frozenDisplay': return ((a.frozenDays ?? -1) - (b.frozenDays ?? -1)) * mult
        default: return 0
      }
    })
  }, [filtered, sort])

  const displayed = useMemo(() => {
    const start = pageIndex * pageSize
    return sorted.slice(start, start + pageSize)
  }, [sorted, pageIndex, pageSize])

  const nullDash = <span style={{ color: 'var(--euiColorSubduedText)' }}>—</span>

  const columns: EuiBasicTableColumn<ILMPolicyRow>[] = [
    {
      field: 'name',
      name: 'Policy',
      sortable: true,
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
      field: 'indexCount',
      name: 'Indices',
      width: '90px',
      align: 'right' as const,
      sortable: true,
      render: (v: number) =>
        v > 0 ? String(v) : <span style={{ color: 'var(--euiColorSubduedText)' }}>0</span>,
    },
    {
      field: 'hotMaxAge',
      name: 'Hot Rollover',
      width: '120px',
      align: 'right' as const,
      render: (age: string | null, item: ILMPolicyRow) => {
        if (!age && !item.hotMaxSize) return nullDash
        const parts = [age, item.hotMaxSize].filter(Boolean)
        return <span style={{ fontSize: '0.85em' }}>{parts.join(' / ')}</span>
      },
    },
    {
      field: 'forceMergeSegments',
      name: 'Force Merge',
      width: '125px',
      align: 'right' as const,
      sortable: true,
      render: (v: number | null) =>
        v !== null ? `${v} seg` : nullDash,
    },
    {
      field: 'shrinkShards',
      name: 'Shrink',
      width: '90px',
      align: 'right' as const,
      sortable: true,
      render: (v: number | null) =>
        v !== null ? `${v} shards` : nullDash,
    },
    {
      field: 'hotDisplay',
      name: 'Hot',
      width: '75px',
      align: 'right' as const,
      sortable: true,
      render: (v: string | null) => v ?? nullDash,
    },
    {
      field: 'warmDisplay',
      name: 'Warm',
      width: '75px',
      align: 'right' as const,
      sortable: true,
      render: (v: string | null) => v ?? nullDash,
    },
    {
      field: 'coldDisplay',
      name: 'Cold',
      width: '75px',
      align: 'right' as const,
      sortable: true,
      render: (v: string | null) => v ?? nullDash,
    },
    {
      field: 'frozenDisplay',
      name: 'Frozen',
      width: '80px',
      align: 'right' as const,
      sortable: true,
      render: (v: string | null) => v ?? nullDash,
    },
  ]

  const sorting = {
    sort: {
      field: sort.field,
      direction: sort.direction,
    },
  }

  const pagination = {
    pageIndex,
    pageSize,
    totalItemCount: sorted.length,
    pageSizeOptions: ILM_PAGE_SIZE_OPTIONS,
  }

  function onTableChange({ sort: newSort, page: newPage }: Criteria<ILMPolicyRow>) {
    if (newSort) {
      const validSortFields: ILMSortField[] = ['name', 'indexCount', 'forceMergeSegments', 'shrinkShards', 'hotDisplay', 'warmDisplay', 'coldDisplay', 'frozenDisplay']
      if (validSortFields.includes(newSort.field as ILMSortField)) {
        setSort({ field: newSort.field as ILMSortField, direction: newSort.direction })
        setPageIndex(0)
      }
    }
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
        sorting={sorting}
        pagination={pagination}
        onChange={onTableChange}
      />
    </div>
  )
}

function formatElasticDuration(value: string): string {
  const match = value.match(/^(\d+(?:\.\d+)?)([smhdwMy])$/)
  if (!match) return value
  const amount = parseFloat(match[1])
  const unit = match[2]
  const toSeconds: Record<string, number> = {
    s: 1, m: 60, h: 3600, d: 86400, w: 604800, M: 2592000, y: 31536000,
  }
  const totalSeconds = amount * (toSeconds[unit] ?? 1)
  const thresholds: [number, string][] = [
    [31536000, 'year'], [2592000, 'month'], [604800, 'week'],
    [86400, 'day'], [3600, 'hour'], [60, 'minute'], [1, 'second'],
  ]
  for (const [secs, label] of thresholds) {
    if (totalSeconds >= secs) {
      const n = totalSeconds / secs
      const rounded = Math.round(n * 10) / 10
      return `${rounded % 1 === 0 ? Math.round(rounded) : rounded} ${label}${rounded !== 1 ? 's' : ''}`
    }
  }
  return value
}

export function SLMPoliciesTable({ policies }: { policies: SLMPolicyDetail[] }) {
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(SLM_DEFAULT_PAGE_SIZE)

  const displayed = useMemo(() => {
    const start = pageIndex * pageSize
    return policies.slice(start, start + pageSize)
  }, [policies, pageIndex, pageSize])

  const columns: EuiBasicTableColumn<SLMPolicyDetail>[] = [
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
      field: 'repository',
      name: 'Repository',
      width: '150px',
      truncateText: true,
      render: (v: string) =>
        v
          ? <span style={{ fontSize: '0.85em' }}>{v}</span>
          : <span style={{ color: 'var(--euiColorSubduedText)' }}>—</span>,
    },
    {
      field: 'schedule',
      name: 'Schedule',
      width: '160px',
      render: (v: string) =>
        v
          ? <span style={{ fontFamily: 'monospace', fontSize: '0.8em' }}>{v}</span>
          : <span style={{ color: 'var(--euiColorSubduedText)' }}>—</span>,
    },
    {
      field: 'retentionExpireAfter',
      name: 'Retention',
      width: '150px',
      render: (expire: string | null, item: SLMPolicyDetail) => {
        if (!expire && item.retentionMaxCount === null) {
          return <span style={{ color: 'var(--euiColorSubduedText)' }}>—</span>
        }
        const parts: string[] = []
        if (expire) parts.push(formatElasticDuration(expire))
        if (item.retentionMaxCount !== null) parts.push(`${item.retentionMaxCount} max`)
        return <span style={{ fontSize: '0.85em' }}>{parts.join(' / ')}</span>
      },
    },
    {
      field: 'lastSuccessDate',
      name: 'Last Success',
      width: '120px',
      render: (v: string | null) =>
        v
          ? <span style={{ fontSize: '0.85em' }}>{new Date(v).toLocaleDateString()}</span>
          : <span style={{ color: 'var(--euiColorSubduedText)' }}>—</span>,
    },
    {
      field: 'lastFailureDate',
      name: 'Last Failure',
      width: '120px',
      render: (v: string | null) =>
        v
          ? <span style={{ fontSize: '0.85em', color: 'var(--euiColorWarningText)' }}>{new Date(v).toLocaleDateString()}</span>
          : <span style={{ color: 'var(--euiColorSubduedText)' }}>—</span>,
    },
    {
      field: 'snapshotsTaken',
      name: 'Taken / Failed',
      width: '110px',
      align: 'right' as const,
      render: (taken: number, item: SLMPolicyDetail) => (
        <span style={{ fontSize: '0.85em' }}>
          {taken} / {item.snapshotsFailed > 0
            ? <span style={{ color: 'var(--euiColorDangerText)' }}>{item.snapshotsFailed}</span>
            : 0}
        </span>
      ),
    },
  ]

  const pagination = {
    pageIndex,
    pageSize,
    totalItemCount: policies.length,
    pageSizeOptions: SLM_PAGE_SIZE_OPTIONS,
  }

  function onTableChange({ page: newPage }: Criteria<SLMPolicyDetail>) {
    if (newPage) {
      setPageIndex(newPage.index)
      setPageSize(newPage.size)
    }
  }

  return (
    <EuiBasicTable
      items={displayed}
      columns={columns}
      pagination={pagination}
      onChange={onTableChange}
    />
  )
}

export default function DataProfile({ stats, ilm, snapshots, sizing, tierStorage }: Props) {
  const hasStats = stats !== null
  const hasIlm = ilm !== null || (tierStorage !== null && Object.keys(tierStorage).length > 0)
  const hasSnapshots = snapshots !== null
  const hasSizing = sizing !== null && (
    sizing.avgQueryRateQPS !== null ||
    sizing.ingestRateGBPerDay !== null ||
    sizing.bulkIngestRateBytesPerDay !== null
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
                  ...(sizing.bulkIngestRateBytesPerDay !== null ? [{
                    title: 'Est. avg bulk ingest rate',
                    description: `~${formatBytes(sizing.bulkIngestRateBytesPerDay)}/day (raw pre-segment, avg over node uptime${sizing.nodeUptimeDays !== null ? ` — ${sizing.nodeUptimeDays.toFixed(1)}d` : ''})`,
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
