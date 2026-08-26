import {
  EuiAccordion,
  EuiBadge,
  EuiBasicTable,
  EuiText,
  EuiToolTip,
  type EuiBasicTableColumn,
} from '@elastic/eui'
import type { ServerlessCheck, ServerlessReadinessInfo } from '../parsers/types'

const CATEGORY_LABEL: Record<string, string> = {
  core: 'Core Platform',
  elasticsearch: 'Elasticsearch',
  observability: 'Observability',
  security: 'Security',
}

// ── Summary row ───────────────────────────────────────────────────────────────

interface SummaryRow {
  blockers: number
  planned: number
  cleared: number
  manualReview: number
}

const summaryColumns: EuiBasicTableColumn<SummaryRow>[] = [
  {
    field: 'blockers',
    name: 'Blockers',
    width: '160px',
    render: (n: number) => (
      <EuiBadge color={n > 0 ? 'danger' : 'default'}>{n}</EuiBadge>
    ),
  },
  {
    field: 'planned',
    name: 'Planned (not yet available)',
    width: '220px',
    render: (n: number) => (
      <EuiBadge color={n > 0 ? 'warning' : 'default'}>{n}</EuiBadge>
    ),
  },
  {
    field: 'cleared',
    name: 'Cleared',
    width: '140px',
    render: (n: number) => (
      <EuiBadge color={n > 0 ? 'success' : 'default'}>{n}</EuiBadge>
    ),
  },
  {
    field: 'manualReview',
    name: 'Manual Review Required',
    render: (n: number) => (
      <EuiToolTip content="These items cannot be determined from the diagnostic bundle and must be confirmed with the customer">
        <EuiBadge color="hollow">{n}</EuiBadge>
      </EuiToolTip>
    ),
  },
]

// ── Detail table ──────────────────────────────────────────────────────────────

function StatusBadge({ check }: { check: ServerlessCheck }) {
  if (check.state === 'blocked') {
    const color = check.severity === 'planned' ? 'warning' : 'danger'
    const label = check.severity === 'planned' ? 'Planned gap' : 'Not supported'
    return <EuiBadge color={color}>{label}</EuiBadge>
  }
  if (check.state === 'clear') {
    return <EuiBadge color="success">Clear</EuiBadge>
  }
  return (
    <EuiToolTip content="Cannot be determined from the diagnostic bundle — verify manually with the customer">
      <EuiBadge color="hollow">Manual review</EuiBadge>
    </EuiToolTip>
  )
}

const detailColumns: EuiBasicTableColumn<ServerlessCheck>[] = [
  {
    field: 'category',
    name: 'Area',
    width: '140px',
    render: (cat: string) => (
      <EuiText size="xs" color="subdued">
        {CATEGORY_LABEL[cat] ?? cat}
      </EuiText>
    ),
  },
  {
    field: 'label',
    name: 'Feature',
    render: (label: string) => <EuiText size="s">{label}</EuiText>,
  },
  {
    field: 'state',
    name: 'Status',
    width: '140px',
    render: (_state: string, check: ServerlessCheck) => <StatusBadge check={check} />,
  },
  {
    field: 'detail',
    name: 'Detail',
    render: (detail: string | null) =>
      detail ? (
        <EuiText size="xs" color="subdued">
          {detail}
        </EuiText>
      ) : null,
  },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function ServerlessReadiness({ readiness }: { readiness: ServerlessReadinessInfo }) {
  const blockers = readiness.checks.filter(c => c.state === 'blocked' && c.severity === 'hard').length
  const planned = readiness.checks.filter(c => c.state === 'blocked' && c.severity === 'planned').length
  const cleared = readiness.checks.filter(c => c.state === 'clear').length
  const manualReview = readiness.checks.filter(c => c.state === 'unknown').length

  const summaryRow: SummaryRow[] = [{ blockers, planned, cleared, manualReview }]

  return (
    <>
      <EuiBasicTable
        items={summaryRow}
        columns={summaryColumns}
      />
      <div style={{ marginTop: 12 }}>
        <EuiAccordion
          id="serverless-readiness-details"
          buttonContent="Full Details"
          initialIsOpen={false}
          paddingSize="m"
        >
          <EuiBasicTable
            items={readiness.checks}
            columns={detailColumns}
            rowProps={(check: ServerlessCheck) => ({
              style: check.state === 'blocked' ? { background: 'rgba(189, 39, 30, 0.15)' } : {},
            })}
          />
        </EuiAccordion>
      </div>
    </>
  )
}
