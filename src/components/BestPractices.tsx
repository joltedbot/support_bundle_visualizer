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
    warning: '70–85% (low watermark)',
    critical: '> 85% (high watermark / flood-stage at 95%)',
  },
  {
    metric: 'CPU',
    healthy: '< 50%',
    warning: '50–80%',
    critical: '> 80%',
  },
  {
    metric: 'Shard Size',
    healthy: '10 GB – 50 GiB',
    warning: '< 10 GB or > 50 GiB',
    critical: '—',
  },
  {
    metric: 'Shard Count',
    healthy: '≤ max_shards_per_node',
    warning: '> 80% of limit',
    critical: '≥ max_shards_per_node',
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
