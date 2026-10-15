import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiPanel,
  EuiTitle,
  EuiSpacer,
  EuiBadge,
  EuiBasicTable,
} from '@elastic/eui'
import type {
  DFAJob,
} from '../../parsers/types'

export function DFAPanel({ jobs }: { jobs: DFAJob[] }) {
  const columns = [
    {
      field: 'id' as const,
      name: 'Job ID',
      render: (id: string) => <code style={{ fontSize: 11 }}>{id}</code>,
    },
    {
      field: 'analysisType' as const,
      name: 'Type',
      render: (t: string) => (
        <EuiBadge color="hollow">{t.replace(/_/g, ' ')}</EuiBadge>
      ),
    },
    {
      field: 'state' as const,
      name: 'State',
      render: (s: string) => (
        <EuiBadge
          color={
            s === 'failed' ? 'danger' : s === 'stopped' ? 'default' : 'success'
          }
        >
          {s}
        </EuiBadge>
      ),
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
          <EuiTitle size="xs"><h3>Data Frame Analytics</h3></EuiTitle>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiBadge color="hollow">
            {jobs.length} job{jobs.length !== 1 ? 's' : ''}
          </EuiBadge>
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiSpacer size="s" />
      <EuiBasicTable items={jobs} columns={columns} tableLayout="auto" />
    </EuiPanel>
  )
}
