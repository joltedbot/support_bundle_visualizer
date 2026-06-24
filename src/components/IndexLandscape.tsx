import { useState, useMemo } from 'react'
import {
  EuiBasicTable,
  EuiBadge,
  EuiButtonEmpty,
  EuiFlexGroup,
  EuiFlexItem,
  EuiIcon,
  EuiToolTip,
  type EuiBasicTableColumn,
  type Criteria,
} from '@elastic/eui'
import type { IndexInfo, ShardInfo } from '../parsers/types'
import { formatBytes, formatCount, healthColor } from '../utils/format'
import { enrichModelLabel } from '../utils/modelHints'

interface Props {
  indices: IndexInfo[]
  shards: ShardInfo[]
}

type SortField = 'name' | 'indexType' | 'ilmPolicy' | 'health' | 'status' | 'primaryShards' | 'replicaShards' | 'avgShardSizeBytes' | 'docCount' | 'storeSizeBytes'

interface SortState {
  field: SortField
  direction: 'asc' | 'desc'
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]
const DEFAULT_PAGE_SIZE = 10

export default function IndexLandscape({ indices, shards }: Props) {
  const [showSystem, setShowSystem] = useState(false)
  const [sort, setSort] = useState<SortState>({ field: 'storeSizeBytes', direction: 'desc' })
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  // Build a set of indices with shard issues
  const flaggedIndices = useMemo(() => {
    const flags = new Set<string>()
    for (const shard of shards) {
      if (shard.oversized || shard.undersized) {
        flags.add(shard.index)
      }
    }
    return flags
  }, [shards])

  const sorted = useMemo(() => {
    const filtered = showSystem ? indices : indices.filter((i) => !i.isSystem)
    return [...filtered].sort((a, b) => {
      const mult = sort.direction === 'asc' ? 1 : -1
      switch (sort.field) {
        case 'name': return a.name.localeCompare(b.name) * mult
        case 'indexType': return ((a.indexType ?? '').localeCompare(b.indexType ?? '')) * mult
        case 'ilmPolicy': return ((a.ilmPolicy ?? '').localeCompare(b.ilmPolicy ?? '')) * mult
        case 'health': return a.health.localeCompare(b.health) * mult
        case 'status': return a.status.localeCompare(b.status) * mult
        case 'primaryShards': return (a.primaryShards - b.primaryShards) * mult
        case 'replicaShards': return (a.replicaShards - b.replicaShards) * mult
        case 'avgShardSizeBytes': return (a.avgShardSizeBytes - b.avgShardSizeBytes) * mult
        case 'docCount': return (a.docCount - b.docCount) * mult
        case 'storeSizeBytes': return (a.storeSizeBytes - b.storeSizeBytes) * mult
        default: return 0
      }
    })
  }, [indices, showSystem, sort])

  const displayed = useMemo(() => {
    const start = pageIndex * pageSize
    return sorted.slice(start, start + pageSize)
  }, [sorted, pageIndex, pageSize])

  const columns: EuiBasicTableColumn<IndexInfo>[] = [
    {
      field: 'name',
      name: 'Name',
      sortable: true,
      truncateText: true,
      render: (name: string, item: IndexInfo) => (
        <EuiFlexGroup gutterSize="xs" alignItems="center" responsive={false}>
          <EuiFlexItem grow={false} style={{ overflow: 'hidden' }}>
            <span
              title={name}
              style={{
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
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
        </EuiFlexGroup>
      ),
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
      name: 'Health',
      width: '90px',
      sortable: true,
      render: (health: string) => (
        <EuiBadge color={healthColor(health)}>{health}</EuiBadge>
      ),
    },
    {
      field: 'status',
      name: 'Status',
      width: '80px',
      sortable: true,
      render: (status: string) => (
        <EuiBadge color={status === 'open' ? 'default' : 'hollow'}>{status}</EuiBadge>
      ),
    },
    {
      field: 'primaryShards',
      name: 'Primaries',
      width: '90px',
      align: 'right' as const,
      sortable: true,
    },
    {
      field: 'replicaShards',
      name: 'Replicas',
      width: '80px',
      align: 'right' as const,
      sortable: true,
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
    pageSizeOptions: PAGE_SIZE_OPTIONS,
  }

  function onTableChange({ sort: newSort, page: newPage }: Criteria<IndexInfo>) {
    if (newSort) {
      const validSortFields: SortField[] = ['name', 'indexType', 'ilmPolicy', 'health', 'status', 'primaryShards', 'replicaShards', 'avgShardSizeBytes', 'docCount', 'storeSizeBytes']
      if (validSortFields.includes(newSort.field as SortField)) {
        setSort({ field: newSort.field as SortField, direction: newSort.direction })
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
            onClick={() => { setShowSystem((v) => !v); setPageIndex(0) }}
            iconType={showSystem ? 'eye' : 'eyeClosed'}
          >
            {showSystem ? 'Hide system indices' : 'Show system indices'}
          </EuiButtonEmpty>
        </EuiFlexItem>
      </EuiFlexGroup>

      <EuiBasicTable
        items={displayed}
        columns={columns}
        sorting={sorting}
        pagination={pagination}
        onChange={onTableChange}
        rowProps={(item) =>
          flaggedIndices.has(item.name) ? { style: { borderLeft: '3px solid var(--euiColorWarning, #f5a700)' } } : {}
        }
      />
    </div>
  )
}
