import { useState, useMemo } from 'react'
import {
  EuiBasicTable,
  EuiButtonEmpty,
  EuiFlexGroup,
  EuiFlexItem,
  EuiToolTip,
  type EuiBasicTableColumn,
  type Criteria,
} from '@elastic/eui'
import type { ILMPolicyDetail } from '../parsers/types'
import { parseMinAgeDays } from '../parsers/ilm'
import { isOneOf } from '../utils/typeGuards'

const ILM_PAGE_SIZE_OPTIONS = [10, 20, 50]
const ILM_DEFAULT_PAGE_SIZE = 10

interface ILMPolicyRow extends ILMPolicyDetail {
  hotDisplay: string | null
  warmDisplay: string | null
  coldDisplay: string | null
  frozenDisplay: string | null
  deleteDisplay: string | null
  hotDays: number | null
  warmDays: number | null
  coldDays: number | null
  frozenDays: number | null
  deleteDaysSort: number | null
}

type ILMSortField = 'name' | 'indexCount' | 'forceMergeSegments' | 'shrinkShards' | 'hotDisplay' | 'warmDisplay' | 'coldDisplay' | 'frozenDisplay' | 'deleteDisplay'

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
    return {
      ...p,
      hotDisplay: null,
      warmDisplay: p.warmMinAge,
      coldDisplay: p.coldMinAge,
      frozenDisplay: p.frozenMinAge,
      deleteDisplay: p.deleteMinAge,
      hotDays: null,
      warmDays: p.warmMinAge ? parseMinAgeDays(p.warmMinAge) : null,
      coldDays: p.coldMinAge ? parseMinAgeDays(p.coldMinAge) : null,
      frozenDays: p.frozenMinAge ? parseMinAgeDays(p.frozenMinAge) : null,
      deleteDaysSort: p.deleteMinAge ? parseMinAgeDays(p.deleteMinAge) : null,
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
        case 'deleteDisplay': return ((a.deleteDaysSort ?? -1) - (b.deleteDaysSort ?? -1)) * mult
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
      sortable: true,
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
    {
      field: 'deleteDisplay',
      name: 'Delete',
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
      const validSortFields: ILMSortField[] = ['name', 'indexCount', 'forceMergeSegments', 'shrinkShards', 'hotDisplay', 'warmDisplay', 'coldDisplay', 'frozenDisplay', 'deleteDisplay']
      if (isOneOf(validSortFields, newSort.field)) {
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
