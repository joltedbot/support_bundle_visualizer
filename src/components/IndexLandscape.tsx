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
import { isOneOf } from '../utils/typeGuards'

interface Props {
  indices: IndexInfo[]
  shards: ShardInfo[]
}

type SortField = 'name' | 'indexType' | 'indexMode' | 'ilmPolicy' | 'models' | 'health' | 'status' | 'primaryShards' | 'avgShardSizeBytes' | 'docCount' | 'storeSizeBytes'

const VALID_SORT_FIELDS: readonly SortField[] = ['name', 'indexType', 'indexMode', 'ilmPolicy', 'models', 'health', 'status', 'primaryShards', 'avgShardSizeBytes', 'docCount', 'storeSizeBytes']

interface SortState {
  field: SortField
  direction: 'asc' | 'desc'
}

const MODE_LABELS: Record<string, { label: string; color: string }> = {
  standard: { label: 'Standard', color: 'hollow' },
  logsdb: { label: 'LogsDB', color: 'warning' },
  time_series: { label: 'TSDS', color: 'accent' },
  lookup: { label: 'Lookup', color: 'default' },
}

// Unknown future modes are shown verbatim rather than dropped
function modeInfo(mode: string): { label: string; color: string } {
  return Object.hasOwn(MODE_LABELS, mode) ? MODE_LABELS[mode] : { label: mode, color: 'default' }
}

function modeLabel(mode: string | null | undefined): string {
  return mode ? modeInfo(mode).label : ''
}

function vectorLabel(v: NonNullable<IndexInfo['vector']>): string {
  const kinds = [v.dense && 'dense', v.sparse && 'sparse', v.semantic && 'semantic'].filter(Boolean).join(', ')
  return v.denseTypes.length > 0 ? `${kinds} (${v.denseTypes.join(', ')})` : kinds
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
        case 'indexMode': return (modeLabel(a.indexMode).localeCompare(modeLabel(b.indexMode))) * mult
        case 'ilmPolicy': return ((a.ilmPolicy ?? '').localeCompare(b.ilmPolicy ?? '')) * mult
        case 'models': return ((a.models?.length ?? 0) - (b.models?.length ?? 0)) * mult
        case 'health': return a.health.localeCompare(b.health) * mult
        case 'status': return a.status.localeCompare(b.status) * mult
        case 'primaryShards': return (a.primaryShards - b.primaryShards) * mult
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
      width: '150px',
      sortable: true,
      render: (_t: IndexInfo['indexType'], item: IndexInfo) => {
        const typeBadge = item.indexType === 'datastream-backing'
          ? <EuiBadge color="accent">DS backing</EuiBadge>
          : item.indexType === 'alias-backing'
          ? <EuiBadge color="primary">Alias</EuiBadge>
          : null
        return typeBadge ?? <span style={{ color: 'var(--euiColorSubduedText)' }}>—</span>
      },
    },
    {
      field: 'indexMode',
      name: 'Mode',
      width: '190px',
      sortable: true,
      render: (_m: string | null | undefined, item: IndexInfo) => {
        const mode = item.indexMode
        // No settings entry for this index: show nothing rather than guess Standard
        if (!mode) return <span style={{ color: 'var(--euiColorSubduedText)' }}>—</span>
        const { label, color } = modeInfo(mode)
        return (
          <EuiFlexGroup gutterSize="xs" responsive={false} wrap>
            <EuiFlexItem grow={false}>
              <EuiBadge color={color}>{label}</EuiBadge>
            </EuiFlexItem>
            {item.syntheticSource && (
              <EuiFlexItem grow={false}>
                <EuiToolTip content="Synthetic _source: the original document is reconstructed from doc values">
                  <EuiBadge color="hollow">Synthetic</EuiBadge>
                </EuiToolTip>
              </EuiFlexItem>
            )}
            {item.vector && (
              <EuiFlexItem grow={false}>
                <EuiToolTip content={`Vector fields: ${vectorLabel(item.vector)}`}>
                  <EuiBadge color="primary">Vector</EuiBadge>
                </EuiToolTip>
              </EuiFlexItem>
            )}
          </EuiFlexGroup>
        )
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
      if (isOneOf(VALID_SORT_FIELDS, newSort.field)) {
        setSort({ field: newSort.field, direction: newSort.direction })
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
