import {
  EuiBadge,
  EuiBasicTable,
  EuiText,
  EuiSpacer,
  type EuiBasicTableColumn,
} from '@elastic/eui'
import type { DataAdoption, DataAdoptionKind, DataAdoptionRow } from '../parsers/types'
import { formatBytes, formatCount } from '../utils/format'

interface Props {
  dataAdoption: DataAdoption | null
}

const KIND_LABELS: Record<DataAdoptionKind, string> = {
  logs: 'Logs',
  metrics: 'Metrics',
  traces: 'Traces',
  security: 'Security',
  synthetics: 'Synthetics',
  vector: 'Vector Search',
  other: 'Other',
}

const columns: EuiBasicTableColumn<DataAdoptionRow>[] = [
  {
    field: 'kind',
    name: 'Data type',
    render: (kind: DataAdoptionKind) => <strong>{KIND_LABELS[kind]}</strong>,
  },
  {
    field: 'kind',
    name: 'Present',
    width: '110px',
    render: (kind: DataAdoptionKind) =>
      kind === 'other' ? <span style={{ color: 'var(--euiColorSubduedText)' }}>—</span> : <EuiBadge color="success">Present</EuiBadge>,
  },
  {
    field: 'indexCount',
    name: 'Indices',
    dataType: 'number',
    render: (n: number) => formatCount(n),
  },
  {
    field: 'docCount',
    name: 'Docs',
    dataType: 'number',
    render: (n: number) => formatCount(n),
  },
  {
    field: 'primaryStoreSizeBytes',
    name: 'Primary storage',
    dataType: 'number',
    render: (n: number) => formatBytes(n),
  },
]

export default function DataAdoptionPanel({ dataAdoption }: Props) {
  if (!dataAdoption || dataAdoption.rows.length === 0) return null

  return (
    <div>
      <EuiBasicTable<DataAdoptionRow>
        items={dataAdoption.rows}
        columns={columns}
        rowHeader="kind"
        tableCaption="Data adoption by type"
      />
      <EuiSpacer size="s" />
      <EuiText size="xs" color="subdued">
        <p>
          Classified from data stream type, index names and index mode; custom-named indices appear under Other.
          Open, non-empty indices only. Primary shards only. Elastic housekeeping indices are excluded.
        </p>
      </EuiText>
    </div>
  )
}
