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

type SortField = 'name' | 'processorCount' | 'createdDate'

interface SortState {
  field: SortField
  direction: 'asc' | 'desc'
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]
const DEFAULT_PAGE_SIZE = 10

export default function IngestPipelines({ pipelines }: Props) {
  const [showManaged, setShowManaged] = useState(false)
  const [sort, setSort] = useState<SortState>({ field: 'name', direction: 'asc' })
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const filtered = useMemo(
    () => showManaged ? pipelines : pipelines.filter(p => !p.metaManaged),
    [pipelines, showManaged]
  )

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const mult = sort.direction === 'asc' ? 1 : -1
      switch (sort.field) {
        case 'name': return a.name.localeCompare(b.name) * mult
        case 'processorCount': return (a.processorCount - b.processorCount) * mult
        case 'createdDate': return ((a.createdDate ?? '').localeCompare(b.createdDate ?? '')) * mult
        default: return 0
      }
    })
  }, [filtered, sort])

  const displayed = useMemo(() => {
    const start = pageIndex * pageSize
    return sorted.slice(start, start + pageSize)
  }, [sorted, pageIndex, pageSize])

  const columns: EuiBasicTableColumn<PipelineInfo>[] = [
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
      field: 'processorCount',
      name: 'Preprocessors',
      width: '120px',
      align: 'right' as const,
      sortable: true,
      render: (count: number) =>
        count > 0
          ? String(count)
          : <span style={{ color: 'var(--euiColorSubduedText)' }}>—</span>,
    },
    {
      field: 'createdDate',
      name: 'Created',
      width: '120px',
      sortable: true,
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

  function onTableChange({ sort: newSort, page: newPage }: Criteria<PipelineInfo>) {
    if (newSort) {
      const validSortFields: SortField[] = ['name', 'processorCount', 'createdDate']
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
        sorting={sorting}
        pagination={pagination}
        onChange={onTableChange}
      />
    </div>
  )
}
