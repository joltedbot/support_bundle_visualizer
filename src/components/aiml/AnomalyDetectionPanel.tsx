import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiPanel,
  EuiText,
  EuiTitle,
  EuiSpacer,
  EuiBadge,
  EuiBasicTable,
  EuiCallOut,
} from '@elastic/eui'
import type {
  AnomalyJob,
} from '../../parsers/types'
import { formatBytes, formatCount } from '../../utils/format'
import { stateColor, datafeedColor, memoryStatusColor } from './labels'

export function AnomalyDetectionPanel({ jobs }: { jobs: AnomalyJob[] }) {
  const criticalJobs = jobs.filter(
    (j) =>
      j.state === 'failed' ||
      j.memoryStatus === 'hard_limit' ||
      (j.state === 'opened' && j.datafeedState === 'stopped'),
  )

  const columns = [
    {
      field: 'jobId' as const,
      name: 'Job ID',
      render: (id: string) => <code style={{ fontSize: 11 }}>{id}</code>,
    },
    {
      field: 'origin' as const,
      name: 'Origin',
      render: (o: string) => (
        <EuiBadge color="hollow">
          {o === 'security'
            ? 'Security'
            : o === 'observability'
              ? 'Observability'
              : 'User'}
        </EuiBadge>
      ),
    },
    {
      field: 'state' as const,
      name: 'State',
      render: (s: string) => <EuiBadge color={stateColor(s)}>{s}</EuiBadge>,
    },
    {
      name: 'Datafeed',
      render: (job: AnomalyJob) => (
        <EuiBadge color={datafeedColor(job.datafeedState, job.state)}>
          {job.datafeedState ?? 'unknown'}
        </EuiBadge>
      ),
    },
    {
      field: 'memoryStatus' as const,
      name: 'Memory',
      render: (s: string) => (
        <EuiBadge color={memoryStatusColor(s)}>{s.replace(/_/g, ' ')}</EuiBadge>
      ),
    },
    {
      field: 'modelBytes' as const,
      name: 'Model Size',
      render: (b: number) => (b > 0 ? formatBytes(b) : '—'),
    },
    {
      field: 'processedRecordCount' as const,
      name: 'Records',
      render: (n: number) => (n > 0 ? formatCount(n) : '—'),
    },
  ]

  return (
    <EuiPanel paddingSize="m">
      <EuiFlexGroup
        justifyContent="spaceBetween"
        alignItems="center"
        gutterSize="s"
      >
        <EuiFlexItem grow={false}>
          <EuiTitle size="xs"><h3>Anomaly Detection</h3></EuiTitle>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiBadge color="hollow">
            {jobs.length} job{jobs.length !== 1 ? 's' : ''}
          </EuiBadge>
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiSpacer size="s" />

      {criticalJobs.map((job) => {
        const isDanger =
          job.state === 'failed' || job.memoryStatus === 'hard_limit'
        let msg = ''
        if (job.state === 'failed') msg = 'Job failed.'
        else if (job.memoryStatus === 'hard_limit')
          msg = 'Job hit memory hard limit — model cannot grow further.'
        else msg = 'Job is opened but datafeed is stopped — no data flowing.'
        if (job.assignmentExplanation) {
          const t = job.assignmentExplanation.slice(0, 200)
          msg += ` ${t}${job.assignmentExplanation.length > 200 ? '…' : ''}`
        }
        return (
          <EuiCallOut
            key={job.jobId}
            color={isDanger ? 'danger' : 'warning'}
            size="s"
            style={{ marginBottom: 8 }}
          >
            <EuiText size="xs">
              <strong>{job.jobId}</strong> — {msg}
            </EuiText>
          </EuiCallOut>
        )
      })}

      <EuiBasicTable items={jobs} columns={columns} tableLayout="auto" />
    </EuiPanel>
  )
}
