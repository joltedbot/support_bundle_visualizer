import { useState, useMemo } from 'react'
import {
  EuiBasicTable,
  EuiBadge,
  EuiFilterButton,
  EuiFilterGroup,
  EuiFlexGroup,
  EuiFlexItem,
  EuiIcon,
  EuiToolTip,
  type EuiBasicTableColumn,
  type Criteria,
} from '@elastic/eui'
import type { IndexInfo, ShardInfo, ReplicationInfo, ReplicationIndex } from '../parsers/types'
import { formatBytes, formatCount, healthColor } from '../utils/format'
import { enrichModelLabel } from '../utils/modelHints'

interface Props {
  indices: IndexInfo[]
  shards: ShardInfo[]
  replication: ReplicationInfo | null
}

type ActiveFilter = 'all' | 'leader' | 'follower' | 'datastream' | 'system'

type StandardSortField =
  | 'name' | 'indexType' | 'ilmPolicy' | 'models'
  | 'health' | 'primaryShards' | 'avgShardSizeBytes' | 'docCount' | 'storeSizeBytes'

type CcrSortField = 'localIndex' | 'remoteIndex' | 'remoteCluster' | 'status' | 'storeSizeBytes'

interface StandardSort { field: StandardSortField; direction: 'asc' | 'desc' }
interface CcrSort { field: CcrSortField; direction: 'asc' | 'desc' }

interface CcrRow extends ReplicationIndex {
  health: IndexInfo['health'] | null
  indexStatus: IndexInfo['status'] | null
  storeSizeBytes: number
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]
const DEFAULT_PAGE_SIZE = 10

// Sort weight for the merged State column: problems surface first in desc, healthy first in asc
function stateWeight(health: IndexInfo['health'] | null, status: IndexInfo['status'] | null): number {
  if (status === 'close') return 3
  if (health === 'red') return 2
  if (health === 'yellow') return 1
  return 0
}

export default function IndexLandscape({ indices, shards, replication }: Props) {
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all')
  const [standardSort, setStandardSort] = useState<StandardSort>({ field: 'storeSizeBytes', direction: 'desc' })
  const [ccrSort, setCcrSort] = useState<CcrSort>({ field: 'localIndex', direction: 'asc' })
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const isCcrFilter = activeFilter === 'leader' || activeFilter === 'follower'

  // Map index name → IndexInfo for CCR enrichment
  const indexInfoMap = useMemo(() => new Map(indices.map(i => [i.name, i])), [indices])

  // Map index name → CCR role for badge display in standard view
  const ccrRoleMap = useMemo(() => {
    const map = new Map<string, 'Leader' | 'Follower'>()
    for (const r of replication?.replicationIndices ?? []) {
      map.set(r.localIndex, r.role)
    }
    return map
  }, [replication])

  // Enrich CCR rows with IndexInfo fields (health, status, size)
  const enrichedCcrRows = useMemo<CcrRow[]>(() => {
    return (replication?.replicationIndices ?? []).map(r => {
      const info = indexInfoMap.get(r.localIndex)
      return {
        ...r,
        health: info?.health ?? null,
        indexStatus: info?.status ?? null,
        storeSizeBytes: info?.storeSizeBytes ?? 0,
      }
    })
  }, [replication, indexInfoMap])

  // Indices with shard sizing issues
  const flaggedIndices = useMemo(() => {
    const flags = new Set<string>()
    for (const shard of shards) {
      if (shard.oversized || shard.undersized) flags.add(shard.index)
    }
    return flags
  }, [shards])

  // Per-filter counts for filter button badges
  const counts = useMemo(() => ({
    all: indices.filter(i => !i.isSystem).length,
    leader: replication?.replicationIndices.filter(r => r.role === 'Leader').length ?? 0,
    follower: replication?.replicationIndices.filter(r => r.role === 'Follower').length ?? 0,
    datastream: indices.filter(i => i.indexType === 'datastream-backing').length,
    system: indices.filter(i => i.isSystem).length,
  }), [indices, replication])

  // Filtered + sorted standard rows
  const filteredStandard = useMemo<IndexInfo[]>(() => {
    let rows: IndexInfo[]
    if (activeFilter === 'system') rows = indices.filter(i => i.isSystem)
    else if (activeFilter === 'datastream') rows = indices.filter(i => i.indexType === 'datastream-backing')
    else rows = indices.filter(i => !i.isSystem)

    return [...rows].sort((a, b) => {
      const m = standardSort.direction === 'asc' ? 1 : -1
      switch (standardSort.field) {
        case 'name': return a.name.localeCompare(b.name) * m
        case 'indexType': return ((a.indexType ?? '').localeCompare(b.indexType ?? '')) * m
        case 'ilmPolicy': return ((a.ilmPolicy ?? '').localeCompare(b.ilmPolicy ?? '')) * m
        case 'models': return ((a.models?.length ?? 0) - (b.models?.length ?? 0)) * m
        case 'health': return (stateWeight(a.health, a.status) - stateWeight(b.health, b.status)) * m
        case 'primaryShards': return (a.primaryShards - b.primaryShards) * m
        case 'avgShardSizeBytes': return (a.avgShardSizeBytes - b.avgShardSizeBytes) * m
        case 'docCount': return (a.docCount - b.docCount) * m
        case 'storeSizeBytes': return (a.storeSizeBytes - b.storeSizeBytes) * m
        default: return 0
      }
    })
  }, [indices, activeFilter, standardSort])

  // Filtered + sorted CCR rows
  const filteredCcr = useMemo<CcrRow[]>(() => {
    const role = activeFilter === 'leader' ? 'Leader' : 'Follower'
    const rows = enrichedCcrRows.filter(r => r.role === role)
    return [...rows].sort((a, b) => {
      const m = ccrSort.direction === 'asc' ? 1 : -1
      switch (ccrSort.field) {
        case 'localIndex': return a.localIndex.localeCompare(b.localIndex) * m
        case 'remoteIndex': return a.remoteIndex.localeCompare(b.remoteIndex) * m
        case 'remoteCluster': return a.remoteCluster.localeCompare(b.remoteCluster) * m
        case 'status': return (a.status ?? '').localeCompare(b.status ?? '') * m
        case 'storeSizeBytes': return (a.storeSizeBytes - b.storeSizeBytes) * m
        default: return 0
      }
    })
  }, [enrichedCcrRows, activeFilter, ccrSort])

  const activeRows = isCcrFilter ? filteredCcr : filteredStandard

  const displayedItems = useMemo(() => {
    const start = pageIndex * pageSize
    return activeRows.slice(start, start + pageSize)
  }, [activeRows, pageIndex, pageSize])

  // ── Column definitions ─────────────────────────────────────────────────

  const standardColumns: EuiBasicTableColumn<IndexInfo>[] = [
    {
      field: 'name',
      name: 'Name',
      sortable: true,
      truncateText: true,
      render: (name: string, item: IndexInfo) => {
        const role = ccrRoleMap.get(name)
        return (
          <EuiFlexGroup gutterSize="xs" alignItems="center" responsive={false}>
            <EuiFlexItem grow={false} style={{ overflow: 'hidden' }}>
              <span
                title={name}
                style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {name}
              </span>
            </EuiFlexItem>
            {flaggedIndices.has(item.name) && (
              <EuiFlexItem grow={false}>
                <EuiToolTip content="Shard sizing issue detected (over or undersized shard)">
                  <EuiIcon type="warning" color="warning" size="s" />
                </EuiToolTip>
              </EuiFlexItem>
            )}
            {role && (
              <EuiFlexItem grow={false}>
                <EuiBadge color="hollow" style={{ fontSize: '0.75em' }}>{role}</EuiBadge>
              </EuiFlexItem>
            )}
          </EuiFlexGroup>
        )
      },
    },
    {
      field: 'indexType',
      name: 'Type',
      width: '110px',
      sortable: true,
      render: (t: IndexInfo['indexType']) => {
        if (t === 'datastream-backing') return <EuiBadge color="accent">DS backing</EuiBadge>
        if (t === 'alias-backing') return <EuiBadge color="primary">Alias</EuiBadge>
        return <span style={{ color: 'var(--euiColorSubduedText)' }}>—</span>
      },
    },
    {
      field: 'ilmPolicy',
      name: 'ILM Policy',
      width: '160px',
      sortable: true,
      truncateText: true,
      render: (policy: string | undefined) => {
        if (!policy) return <span style={{ color: 'var(--euiColorSubduedText)' }}>—</span>
        return (
          <EuiToolTip content={policy}>
            <span
              style={{
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: '0.85em',
              }}
            >
              {policy}
            </span>
          </EuiToolTip>
        )
      },
    },
    {
      field: 'models',
      name: 'Models',
      width: '250px',
      sortable: true,
      truncateText: true,
      render: (models: string[] | undefined) => {
        if (!models || models.length === 0) return <span style={{ color: 'var(--euiColorSubduedText)' }}>—</span>
        return (
          <EuiFlexGroup gutterSize="xs" wrap responsive={false}>
            {models.map((m) => (
              <EuiFlexItem key={m} grow={false}>
                <EuiToolTip content={enrichModelLabel(m)}>
                  <EuiBadge color="hollow" style={{ fontSize: '0.85em' }}>
                    {enrichModelLabel(m).length > 40 ? `${enrichModelLabel(m).substring(0, 40)}…` : enrichModelLabel(m)}
                  </EuiBadge>
                </EuiToolTip>
              </EuiFlexItem>
            ))}
          </EuiFlexGroup>
        )
      },
    },
    {
      field: 'health',
      name: 'State',
      width: '90px',
      sortable: true,
      render: (_: string, item: IndexInfo) => {
        if (item.status === 'close') return <EuiBadge color="default">closed</EuiBadge>
        return <EuiBadge color={healthColor(item.health)}>{item.health}</EuiBadge>
      },
    },
    {
      field: 'primaryShards',
      name: 'Shards',
      width: '80px',
      align: 'right' as const,
      sortable: true,
      render: (_: number, item: IndexInfo) => `${item.primaryShards}P ${item.replicaShards}R`,
    },
    {
      field: 'avgShardSizeBytes',
      name: 'Avg Shard Size',
      width: '120px',
      align: 'right' as const,
      sortable: true,
      render: (b: number) => {
        if (b === 0) return <span style={{ color: 'var(--euiColorSubduedText)' }}>—</span>
        return formatBytes(b)
      },
    },
    {
      field: 'docCount',
      name: 'Docs',
      width: '100px',
      align: 'right' as const,
      sortable: true,
      render: (n: number) => formatCount(n),
    },
    {
      field: 'storeSizeBytes',
      name: 'Size',
      width: '100px',
      align: 'right' as const,
      sortable: true,
      render: (b: number) => formatBytes(b),
    },
  ]

  const ccrColumns: EuiBasicTableColumn<CcrRow>[] = [
    {
      field: 'localIndex',
      name: 'Local Index',
      sortable: true,
      truncateText: true,
      render: (name: string, item: CcrRow) => (
        <EuiFlexGroup gutterSize="xs" alignItems="center" responsive={false}>
          <EuiFlexItem grow={false} style={{ overflow: 'hidden' }}>
            <span title={name} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <strong>{name}</strong>
            </span>
          </EuiFlexItem>
          {flaggedIndices.has(item.localIndex) && (
            <EuiFlexItem grow={false}>
              <EuiToolTip content="Shard sizing issue detected (over or undersized shard)">
                <EuiIcon type="warning" color="warning" size="s" />
              </EuiToolTip>
            </EuiFlexItem>
          )}
        </EuiFlexGroup>
      ),
    },
    {
      field: 'remoteIndex',
      name: 'Remote Index',
      sortable: true,
      truncateText: true,
      render: (name: string) => (
        <span title={name} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </span>
      ),
    },
    {
      field: 'remoteCluster',
      name: 'Remote Cluster',
      width: '150px',
      sortable: true,
      render: (name: string) => <EuiBadge color="hollow">{name}</EuiBadge>,
    },
    {
      field: 'health',
      name: 'State',
      width: '90px',
      sortable: false,
      render: (_: unknown, item: CcrRow) => {
        if (!item.health) return <span style={{ color: 'var(--euiColorSubduedText)' }}>—</span>
        if (item.indexStatus === 'close') return <EuiBadge color="default">closed</EuiBadge>
        return <EuiBadge color={healthColor(item.health)}>{item.health}</EuiBadge>
      },
    },
    {
      field: 'status',
      name: 'CCR Status',
      width: '110px',
      sortable: true,
      render: (status: string | null) =>
        status
          ? <EuiBadge color={status === 'active' ? 'success' : 'warning'}>{status}</EuiBadge>
          : <span style={{ color: 'var(--euiColorSubduedText)' }}>—</span>,
    },
    {
      field: 'storeSizeBytes',
      name: 'Size',
      width: '100px',
      align: 'right' as const,
      sortable: true,
      render: (b: number) =>
        b > 0 ? formatBytes(b) : <span style={{ color: 'var(--euiColorSubduedText)' }}>—</span>,
    },
  ]

  // ── Sorting / pagination ───────────────────────────────────────────────

  const standardSorting = { sort: { field: standardSort.field, direction: standardSort.direction } }
  const ccrSorting = { sort: { field: ccrSort.field, direction: ccrSort.direction } }

  const pagination = {
    pageIndex,
    pageSize,
    totalItemCount: activeRows.length,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
  }

  function onStandardChange({ sort: newSort, page: newPage }: Criteria<IndexInfo>) {
    if (newSort) {
      const valid: StandardSortField[] = [
        'name', 'indexType', 'ilmPolicy', 'models', 'health',
        'primaryShards', 'avgShardSizeBytes', 'docCount', 'storeSizeBytes',
      ]
      if (valid.includes(newSort.field as StandardSortField)) {
        setStandardSort({ field: newSort.field as StandardSortField, direction: newSort.direction })
        setPageIndex(0)
      }
    }
    if (newPage) {
      setPageIndex(newPage.index)
      setPageSize(newPage.size)
    }
  }

  function onCcrChange({ sort: newSort, page: newPage }: Criteria<CcrRow>) {
    if (newSort) {
      const valid: CcrSortField[] = ['localIndex', 'remoteIndex', 'remoteCluster', 'status', 'storeSizeBytes']
      if (valid.includes(newSort.field as CcrSortField)) {
        setCcrSort({ field: newSort.field as CcrSortField, direction: newSort.direction })
        setPageIndex(0)
      }
    }
    if (newPage) {
      setPageIndex(newPage.index)
      setPageSize(newPage.size)
    }
  }

  function handleFilterChange(filter: ActiveFilter) {
    setActiveFilter(filter)
    setPageIndex(0)
    if (filter === 'leader' || filter === 'follower') {
      setCcrSort({ field: 'localIndex', direction: 'asc' })
    } else {
      setStandardSort({ field: 'storeSizeBytes', direction: 'desc' })
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  const hasCcr = (replication?.followerIndexCount ?? 0) > 0 || (replication?.leaderIndexCount ?? 0) > 0

  return (
    <div>
      <EuiFlexGroup justifyContent="flexStart" gutterSize="s" responsive={false} style={{ marginBottom: 8 }}>
        <EuiFlexItem grow={false}>
          <EuiFilterGroup>
            <EuiFilterButton
              isSelected={activeFilter === 'all'}
              hasActiveFilters={activeFilter === 'all'}
              numFilters={counts.all}
              onClick={() => handleFilterChange('all')}
            >
              All
            </EuiFilterButton>
            {hasCcr && (
              <EuiFilterButton
                isSelected={activeFilter === 'leader'}
                hasActiveFilters={activeFilter === 'leader'}
                numFilters={counts.leader}
                onClick={() => handleFilterChange('leader')}
              >
                Leader
              </EuiFilterButton>
            )}
            {hasCcr && (
              <EuiFilterButton
                isSelected={activeFilter === 'follower'}
                hasActiveFilters={activeFilter === 'follower'}
                numFilters={counts.follower}
                onClick={() => handleFilterChange('follower')}
              >
                Follower
              </EuiFilterButton>
            )}
            {counts.datastream > 0 && (
              <EuiFilterButton
                isSelected={activeFilter === 'datastream'}
                hasActiveFilters={activeFilter === 'datastream'}
                numFilters={counts.datastream}
                onClick={() => handleFilterChange('datastream')}
              >
                Data Stream
              </EuiFilterButton>
            )}
            {counts.system > 0 && (
              <EuiFilterButton
                isSelected={activeFilter === 'system'}
                hasActiveFilters={activeFilter === 'system'}
                numFilters={counts.system}
                onClick={() => handleFilterChange('system')}
              >
                System
              </EuiFilterButton>
            )}
          </EuiFilterGroup>
        </EuiFlexItem>
      </EuiFlexGroup>

      {isCcrFilter ? (
        <EuiBasicTable<CcrRow>
          items={displayedItems as CcrRow[]}
          columns={ccrColumns}
          sorting={ccrSorting}
          pagination={pagination}
          onChange={onCcrChange}
        />
      ) : (
        <EuiBasicTable<IndexInfo>
          items={displayedItems as IndexInfo[]}
          columns={standardColumns}
          sorting={standardSorting}
          pagination={pagination}
          onChange={onStandardChange}
          rowProps={(item) =>
            flaggedIndices.has(item.name)
              ? { style: { borderLeft: '3px solid var(--euiColorWarning, #f5a700)' } }
              : {}
          }
        />
      )}
    </div>
  )
}
