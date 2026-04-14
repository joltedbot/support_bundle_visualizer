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
import type { PipelineInfo } from '../parsers/types'
import { formatDate } from '../utils/format'

interface Props {
  pipelines: PipelineInfo[]
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]
const DEFAULT_PAGE_SIZE = 10

export default function IngestPipelines({ pipelines }: Props) {
  const [showManaged, setShowManaged] = useState(false)
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const filtered = useMemo(
    () => showManaged ? pipelines : pipelines.filter(p => !p.metaManaged),
    [pipelines, showManaged]
  )

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => a.name.localeCompare(b.name)),
    [filtered]
  )

  const displayed = useMemo(() => {
    const start = pageIndex * pageSize
    return sorted.slice(start, start + pageSize)
  }, [sorted, pageIndex, pageSize])

  const columns: EuiBasicTableColumn<PipelineInfo>[] = [
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
            fontWeight: 'bold',
          }}
        >
          {name}
        </span>
      ),
    },
    {
      field: 'description',
      name: 'Description',
      truncateText: true,
      render: (description: string | undefined) => {
        if (!description) return <span style={{ color: 'var(--euiColorSubduedText)' }}>—</span>
        return (
          <EuiToolTip content={description}>
            <span
              style={{
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: '0.9em',
              }}
            >
              {description}
            </span>
          </EuiToolTip>
        )
      },
    },
    {
      field: 'createdDate',
      name: 'Created',
      width: '120px',
      render: (date: string | undefined) => {
        if (!date) return <span style={{ color: 'var(--euiColorSubduedText)' }}>—</span>
        return <span>{formatDate(date)}</span>
      },
    },
    {
      field: 'metaManaged',
      name: '',
      width: '100px',
      render: (managed: boolean | undefined) => {
        if (!managed) return null
        return <EuiBadge color="hollow">Managed</EuiBadge>
      },
    },
    {
      field: 'metaManagedBy',
      name: 'Managed By',
      width: '120px',
      render: (managedBy: string | undefined) => {
        if (!managedBy) return <span style={{ color: 'var(--euiColorSubduedText)' }}>—</span>
        return <EuiBadge color="subdued">{managedBy}</EuiBadge>
      },
    },
    {
      field: 'metaPackageName',
      name: 'Package',
      width: '120px',
      render: (pkg: string | undefined) => {
        if (!pkg) return <span style={{ color: 'var(--euiColorSubduedText)' }}>—</span>
        return <EuiBadge color="accent">{pkg}</EuiBadge>
      },
    },
  ]

  const pagination = {
    pageIndex,
    pageSize,
    totalItemCount: sorted.length,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
  }

  function onTableChange({ page: newPage }: Criteria<PipelineInfo>) {
    if (newPage) {
      setPageIndex(newPage.index)
      setPageSize(newPage.size)
    }
  }

  if (pipelines.length === 0) return null

  return (
    <div>
      <EuiFlexGroup justifyContent="flexEnd" gutterSize="s" responsive={false}>
        <EuiFlexItem grow={false}>
          <EuiButtonEmpty
            size="s"
            onClick={() => { setShowManaged(v => !v); setPageIndex(0) }}
            iconType={showManaged ? 'eye' : 'eyeClosed'}
          >
            {showManaged ? 'Hide managed pipelines' : 'Show managed pipelines'}
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
