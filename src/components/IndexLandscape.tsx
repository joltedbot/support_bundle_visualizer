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

interface Props {
  indices: IndexInfo[]
  shards: ShardInfo[]
}

type SortField = 'storeSizeBytes' | 'docCount'

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
      return (a[sort.field] - b[sort.field]) * mult
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
      field: 'ilmPolicy',
      name: 'ILM Policy',
      width: '160px',
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
      width: '180px',
      truncateText: true,
      render: (models: string[] | undefined) => {
        if (!models || models.length === 0) return <span style={{ color: 'var(--euiColorSubduedText)' }}>—</span>
        return (
          <EuiFlexGroup gutterSize="xs" wrap responsive={false}>
            {models.map((m) => (
              <EuiFlexItem key={m} grow={false}>
                <EuiToolTip content={m}>
                  <EuiBadge color="hollow" style={{ fontSize: '0.85em' }}>
                    {m.length > 20 ? `${m.substring(0, 20)}…` : m}
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
      render: (health: string) => (
        <EuiBadge color={healthColor(health)}>{health}</EuiBadge>
      ),
    },
    {
      field: 'status',
      name: 'Status',
      width: '80px',
      render: (status: string) => (
        <EuiBadge color={status === 'open' ? 'default' : 'hollow'}>{status}</EuiBadge>
      ),
    },
    {
      field: 'primaryShards',
      name: 'Primaries',
      width: '90px',
      align: 'right' as const,
    },
    {
      field: 'replicaShards',
      name: 'Replicas',
      width: '80px',
      align: 'right' as const,
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
      const validSortFields: SortField[] = ['storeSizeBytes', 'docCount']
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
