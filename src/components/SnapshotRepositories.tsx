import {
  EuiBasicTable,
  EuiBadge,
  EuiText,
  EuiFlexGroup,
  EuiFlexItem,
  EuiPanel,
  EuiSpacer,
  EuiTitle,
} from '@elastic/eui'
import type { SnapshotRepository } from '../parsers/types'

interface Props {
  repositories: SnapshotRepository[]
}

export default function SnapshotRepositories({ repositories }: Props) {
  if (repositories.length === 0) return null

  const columns = [
    {
      field: 'name',
      name: 'Name',
      render: (name: string) => <strong>{name}</strong>,
    },
    {
      field: 'type',
      name: 'Type',
      render: (type: string) => <EuiBadge color="hollow">{type}</EuiBadge>,
    },
    {
      field: 'snapshotCount',
      name: 'Snapshots',
      render: (count: number) => <strong>{count}</strong>,
    },
    {
      name: 'Status Summary',
      render: (repo: SnapshotRepository) => {
        if (repo.snapshotCount === 0) return <EuiText size="xs" color="subdued">No snapshots</EuiText>
        return (
          <EuiFlexGroup gutterSize="xs">
            {repo.successCount > 0 && (
              <EuiFlexItem grow={false}>
                <EuiBadge color="success">{repo.successCount} Success</EuiBadge>
              </EuiFlexItem>
            )}
            {repo.failedCount > 0 && (
              <EuiFlexItem grow={false}>
                <EuiBadge color="danger">{repo.failedCount} Failed/Partial</EuiBadge>
              </EuiFlexItem>
            )}
          </EuiFlexGroup>
        )
      },
    },
    {
      name: 'Key Settings',
      render: (repo: SnapshotRepository) => {
        const keySettings = []
        if (repo.settings.bucket) keySettings.push(`bucket: ${repo.settings.bucket}`)
        if (repo.settings.container) keySettings.push(`container: ${repo.settings.container}`)
        if (repo.settings.base_path) keySettings.push(`path: ${repo.settings.base_path}`)
        if (repo.settings.location) keySettings.push(`location: ${repo.settings.location}`)
        if (repo.settings.compress) keySettings.push(`compress: ${repo.settings.compress}`)
        
        if (keySettings.length === 0) return '—'
        return (
          <EuiText size="xs" color="subdued">
            {keySettings.map(s => <div key={s}>{s}</div>)}
          </EuiText>
        )
      },
    },
  ]

  return (
    <>
      <EuiSpacer size="l" />
      <EuiTitle size="s"><h3>Snapshot Repositories</h3></EuiTitle>
      <EuiSpacer size="s" />
      <EuiPanel paddingSize="m">
        <EuiBasicTable
          items={repositories}
          columns={columns}
          noItemsMessage="No snapshot repositories found"
        />
      </EuiPanel>
    </>
  )
}
