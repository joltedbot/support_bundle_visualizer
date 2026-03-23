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

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]
const DEFAULT_PAGE_SIZE = 10

export default function DataStreams({ dataStreams }: Props) {
  const [showSystem, setShowSystem] = useState(false)
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const filtered = useMemo(
    () => showSystem ? dataStreams : dataStreams.filter(d => !d.isSystem),
    [dataStreams, showSystem]
  )

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => a.name.localeCompare(b.name)),
    [filtered]
  )

  const displayed = useMemo(() => {
    const start = pageIndex * pageSize
    return sorted.slice(start, start + pageSize)
  }, [sorted, pageIndex, pageSize])

  const columns: EuiBasicTableColumn<DataStreamInfo>[] = [
    {
      field: 'name',
      name: 'Name',
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
      render: (status: string) => (
        <EuiBadge color={healthColor(status.toLowerCase())}>{status}</EuiBadge>
      ),
    },
    {
      field: 'indexCount',
      name: 'Indices',
      width: '80px',
      align: 'right' as const,
    },
    {
      field: 'lifecycle',
      name: 'Lifecycle',
      width: '120px',
      render: (_: unknown, item: DataStreamInfo) => {
        if (item.lifecycle) return <span>{item.lifecycle}</span>
        if (item.managedBy) {
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
                {item.managedBy}
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

  const pagination = {
    pageIndex,
    pageSize,
    totalItemCount: sorted.length,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
  }

  function onTableChange({ page: newPage }: Criteria<DataStreamInfo>) {
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
        pagination={pagination}
        onChange={onTableChange}
      />
    </div>
  )
}
