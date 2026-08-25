import {
  EuiAccordion,
  EuiBadge,
  EuiBasicTable,
  EuiText,
  EuiToolTip,
  type EuiBasicTableColumn,
} from '@elastic/eui'
import type { ServerlessCheck, ServerlessReadinessInfo } from '../parsers/types'

const SEVERITY_LABEL: Record<string, string> = {
  hard: 'Not supported',
  planned: 'Planned gap',
}

const CATEGORY_LABEL: Record<string, string> = {
  core: 'Core Platform',
  elasticsearch: 'Elasticsearch',
  observability: 'Observability',
  security: 'Security',
}

function StatusBadge({ check }: { check: ServerlessCheck }) {
  if (check.state === 'blocked') {
    const color = check.severity === 'planned' ? 'warning' : 'danger'
    const label = SEVERITY_LABEL[check.severity] ?? 'Blocked'
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

const columns: EuiBasicTableColumn<ServerlessCheck>[] = [
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

export default function ServerlessReadiness({ readiness }: { readiness: ServerlessReadinessInfo }) {
  const blockedCount = readiness.checks.filter(c => c.state === 'blocked').length
  const buttonContent = blockedCount > 0
    ? `Serverless Readiness — ${blockedCount} blocker${blockedCount > 1 ? 's' : ''} detected`
    : 'Serverless Readiness'

  return (
    <EuiAccordion
      id="serverless-readiness-accordion"
      buttonContent={buttonContent}
      initialIsOpen={false}
      paddingSize="m"
    >
      <div style={{ marginTop: 16 }}>
        <EuiText size="s" color="subdued" style={{ marginBottom: 12 }}>
          <p>
            Features not available or not yet available in Elastic Serverless, based on this diagnostic bundle.
            Items marked <strong>Manual review</strong> cannot be determined from the bundle and should be confirmed with the customer.
          </p>
        </EuiText>
        <EuiBasicTable
          items={readiness.checks}
          columns={columns}
          rowProps={(check: ServerlessCheck) => ({
            style: check.state === 'blocked' ? { background: 'rgba(189, 39, 30, 0.04)' } : {},
          })}
        />
      </div>
    </EuiAccordion>
  )
}
