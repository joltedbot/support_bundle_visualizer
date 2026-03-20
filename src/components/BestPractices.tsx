import {
  EuiAccordion,
  EuiBasicTable,
  EuiText,
  type EuiBasicTableColumn,
} from '@elastic/eui'

interface Threshold {
  metric: string
  healthy: string
  warning: string
  critical: string
}

const thresholds: Threshold[] = [
  {
    metric: 'JVM Heap',
    healthy: '< 75%',
    warning: '75–85%',
    critical: '> 85%',
  },
  {
    metric: 'Disk Used',
    healthy: '< 70%',
    warning: '70–85%',
    critical: '> 85%',
  },
  {
    metric: 'CPU',
    healthy: '< 50%',
    warning: '50–80%',
    critical: '> 80%',
  },
  {
    metric: 'Shard Size',
    healthy: '10–50 GB',
    warning: '< 10 GB or > 50 GB',
    critical: '—',
  },
  {
    metric: 'Shard Count',
    healthy: '≤ 20 per GB heap',
    warning: '—',
    critical: '> 30 per GB heap',
  },
]

const columns: EuiBasicTableColumn<Threshold>[] = [
  {
    field: 'metric',
    name: 'Metric',
    width: '120px',
    render: (metric: string) => (
      <EuiText size="s">
        <strong>{metric}</strong>
      </EuiText>
    ),
  },
  {
    field: 'healthy',
    name: 'Healthy',
    align: 'left' as const,
    render: (val: string) => (
      <EuiText size="s" color="success">
        {val}
      </EuiText>
    ),
  },
  {
    field: 'warning',
    name: 'Warning',
    align: 'left' as const,
    render: (val: string) => (
      <EuiText size="s" color="warning">
        {val}
      </EuiText>
    ),
  },
  {
    field: 'critical',
    name: 'Critical',
    align: 'left' as const,
    render: (val: string) => (
      <EuiText size="s" color="danger">
        {val}
      </EuiText>
    ),
  },
]

export default function BestPractices() {
  return (
    <EuiAccordion
      id="best-practices-accordion"
      buttonContent="Best Practice Reference"
      initialIsOpen={false}
      paddingSize="m"
    >
      <div style={{ marginTop: 16 }}>
        <EuiText size="s" color="subdued" style={{ marginBottom: 12 }}>
          <p>
            Elastic Support Association (SA) recommended thresholds for a healthy cluster:
          </p>
        </EuiText>
        <EuiBasicTable items={thresholds} columns={columns} />
      </div>
    </EuiAccordion>
  )
}
