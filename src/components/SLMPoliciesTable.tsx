import { useState, useMemo } from 'react'
import {
  EuiBasicTable,
  EuiToolTip,
  type EuiBasicTableColumn,
  type Criteria,
} from '@elastic/eui'
import type { SLMPolicyDetail } from '../parsers/types'

const SLM_PAGE_SIZE_OPTIONS = [10, 20, 50]
const SLM_DEFAULT_PAGE_SIZE = 10

function formatElasticDuration(value: string): string {
  const match = value.match(/^(\d+(?:\.\d+)?)([smhdwMy])$/)
  if (!match) return value
  const amount = parseFloat(match[1])
  const unit = match[2]
  const toSeconds: Record<string, number> = {
    s: 1, m: 60, h: 3600, d: 86400, w: 604800, M: 2592000, y: 31536000,
  }
  const totalSeconds = amount * (toSeconds[unit] ?? 1)
  const thresholds: [number, string][] = [
    [31536000, 'year'], [2592000, 'month'], [604800, 'week'],
    [86400, 'day'], [3600, 'hour'], [60, 'minute'], [1, 'second'],
  ]
  for (const [secs, label] of thresholds) {
    if (totalSeconds >= secs) {
      const n = totalSeconds / secs
      const rounded = Math.round(n * 10) / 10
      return `${rounded % 1 === 0 ? Math.round(rounded) : rounded} ${label}${rounded !== 1 ? 's' : ''}`
    }
  }
  return value
}

export function SLMPoliciesTable({ policies }: { policies: SLMPolicyDetail[] }) {
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(SLM_DEFAULT_PAGE_SIZE)

  const displayed = useMemo(() => {
    const start = pageIndex * pageSize
    return policies.slice(start, start + pageSize)
  }, [policies, pageIndex, pageSize])

  const columns: EuiBasicTableColumn<SLMPolicyDetail>[] = [
    {
      field: 'name',
      name: 'Policy',
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
      field: 'repository',
      name: 'Repository',
      width: '150px',
      truncateText: true,
      render: (v: string) =>
        v
          ? <span style={{ fontSize: '0.85em' }}>{v}</span>
          : <span style={{ color: 'var(--euiColorSubduedText)' }}>—</span>,
    },
    {
      field: 'schedule',
      name: 'Schedule',
      width: '160px',
      render: (v: string) =>
        v
          ? <span style={{ fontFamily: 'monospace', fontSize: '0.8em' }}>{v}</span>
          : <span style={{ color: 'var(--euiColorSubduedText)' }}>—</span>,
    },
    {
      field: 'retentionExpireAfter',
      name: 'Retention',
      width: '150px',
      render: (expire: string | null, item: SLMPolicyDetail) => {
        if (!expire && item.retentionMaxCount === null) {
          return <span style={{ color: 'var(--euiColorSubduedText)' }}>—</span>
        }
        const parts: string[] = []
        if (expire) parts.push(formatElasticDuration(expire))
        if (item.retentionMaxCount !== null) parts.push(`${item.retentionMaxCount} max`)
        return <span style={{ fontSize: '0.85em' }}>{parts.join(' / ')}</span>
      },
    },
    {
      field: 'lastSuccessDate',
      name: 'Last Success',
      width: '120px',
      render: (v: string | null) =>
        v
          ? <span style={{ fontSize: '0.85em' }}>{new Date(v).toLocaleDateString()}</span>
          : <span style={{ color: 'var(--euiColorSubduedText)' }}>—</span>,
    },
    {
      field: 'lastFailureDate',
      name: 'Last Failure',
      width: '120px',
      render: (v: string | null) =>
        v
          ? <span style={{ fontSize: '0.85em', color: 'var(--euiColorWarningText)' }}>{new Date(v).toLocaleDateString()}</span>
          : <span style={{ color: 'var(--euiColorSubduedText)' }}>—</span>,
    },
    {
      field: 'snapshotsTaken',
      name: 'Taken / Failed',
      width: '110px',
      align: 'right' as const,
      render: (taken: number, item: SLMPolicyDetail) => (
        <span style={{ fontSize: '0.85em' }}>
          {taken} / {item.snapshotsFailed > 0
            ? <span style={{ color: 'var(--euiColorDangerText)' }}>{item.snapshotsFailed}</span>
            : 0}
        </span>
      ),
    },
  ]

  const pagination = {
    pageIndex,
    pageSize,
    totalItemCount: policies.length,
    pageSizeOptions: SLM_PAGE_SIZE_OPTIONS,
  }

  function onTableChange({ page: newPage }: Criteria<SLMPolicyDetail>) {
    if (newPage) {
      setPageIndex(newPage.index)
      setPageSize(newPage.size)
    }
  }

  return (
    <EuiBasicTable
      items={displayed}
      columns={columns}
      pagination={pagination}
      onChange={onTableChange}
    />
  )
}
