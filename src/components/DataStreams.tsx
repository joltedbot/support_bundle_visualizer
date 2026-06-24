import { useState, useMemo } from 'react'
import {
  EuiBasicTable,
  EuiBadge,
  EuiButtonEmpty,
  EuiFlexGroup,
  EuiFlexItem,
  EuiToolTip,
  type EuiBasicTableColumn,
  type Criteria,
} from '@elastic/eui'
import type { DataStreamInfo } from '../parsers/types'
import { healthColor } from '../utils/format'

interface Props {
  dataStreams: DataStreamInfo[]
}

type SortField = 'name' | 'status' | 'indexCount' | 'ilmPolicy'

interface SortState {
  field: SortField
  direction: 'asc' | 'desc'
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]
const DEFAULT_PAGE_SIZE = 10

export default function DataStreams({ dataStreams }: Props) {
  const [showSystem, setShowSystem] = useState(false)
  const [sort, setSort] = useState<SortState>({ field: 'name', direction: 'asc' })
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const filtered = useMemo(
    () => showSystem ? dataStreams : dataStreams.filter(d => !d.isSystem),
    [dataStreams, showSystem]
  )

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const mult = sort.direction === 'asc' ? 1 : -1
      switch (sort.field) {
        case 'name': return a.name.localeCompare(b.name) * mult
        case 'status': return a.status.localeCompare(b.status) * mult
        case 'indexCount': return (a.indexCount - b.indexCount) * mult
        case 'ilmPolicy': return ((a.ilmPolicy ?? '').localeCompare(b.ilmPolicy ?? '')) * mult
        default: return 0
      }
    })
  }, [filtered, sort])

  const displayed = useMemo(() => {
    const start = pageIndex * pageSize
    return sorted.slice(start, start + pageSize)
  }, [sorted, pageIndex, pageSize])

  const columns: EuiBasicTableColumn<DataStreamInfo>[] = [
    {
      field: 'name',
      name: 'Name',
      sortable: true,
      truncateText: true,
      render: (name: string) => (
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
      ),
    },
    {
      field: 'status',
      name: 'Status',
      width: '90px',
      sortable: true,
      render: (status: string) => (
        <EuiBadge color={healthColor(status.toLowerCase())}>{status}</EuiBadge>
      ),
    },
    {
      field: 'indexCount',
      name: 'Indices',
      width: '80px',
      align: 'right' as const,
      sortable: true,
    },
    {
      field: 'lifecycle',
      name: 'Lifecycle',
      width: '120px',
      render: (_: unknown, item: DataStreamInfo) => {
        if (item.lifecycle) return <span>{item.lifecycle}</span>
        if (item.managedBy) {
          const label = item.managedBy === 'Index Lifecycle Management' ? 'ILM' : item.managedBy
          return (
            <EuiToolTip content={item.managedBy}>
              <span
                style={{
                  display: 'block',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: '0.85em',
                  color: 'var(--euiColorSubduedText)',
                }}
              >
                {label}
              </span>
            </EuiToolTip>
          )
        }
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

  function onTableChange({ sort: newSort, page: newPage }: Criteria<DataStreamInfo>) {
    if (newSort) {
      const validSortFields: SortField[] = ['name', 'status', 'indexCount', 'ilmPolicy']
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

  if (dataStreams.length === 0) return null

  return (
    <div>
      <EuiFlexGroup justifyContent="flexEnd" gutterSize="s" responsive={false}>
        <EuiFlexItem grow={false}>
          <EuiButtonEmpty
            size="s"
            onClick={() => { setShowSystem(v => !v); setPageIndex(0) }}
            iconType={showSystem ? 'eye' : 'eyeClosed'}
          >
            {showSystem ? 'Hide system data streams' : 'Show system data streams'}
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
