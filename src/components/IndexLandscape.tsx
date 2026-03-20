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

export default function IndexLandscape({ indices, shards }: Props) {
  const [showSystem, setShowSystem] = useState(false)
  const [sort, setSort] = useState<SortState>({ field: 'storeSizeBytes', direction: 'desc' })

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

  const displayed = useMemo(() => {
    const filtered = showSystem ? indices : indices.filter((i) => !i.isSystem)
    return [...filtered].sort((a, b) => {
      const mult = sort.direction === 'asc' ? 1 : -1
      return (a[sort.field] - b[sort.field]) * mult
    })
  }, [indices, showSystem, sort])

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

  function onTableChange({ sort: newSort }: Criteria<IndexInfo>) {
    if (newSort) {
      const validSortFields: SortField[] = ['storeSizeBytes', 'docCount']
      if (validSortFields.includes(newSort.field as SortField)) {
        setSort({ field: newSort.field as SortField, direction: newSort.direction })
      }
    }
  }

  return (
    <div>
      <EuiFlexGroup justifyContent="flexEnd" gutterSize="s" responsive={false}>
        <EuiFlexItem grow={false}>
          <EuiButtonEmpty
            size="s"
            onClick={() => setShowSystem((v) => !v)}
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
        onChange={onTableChange}
        rowProps={(item) =>
          flaggedIndices.has(item.name) ? { style: { borderLeft: '3px solid var(--euiColorWarning, #f5a700)' } } : {}
        }
      />
    </div>
  )
}
