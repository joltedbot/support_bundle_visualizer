import {
  EuiBasicTable,
  type EuiBasicTableColumn,
} from '@elastic/eui'
import type { PluginEntry } from '../parsers/types'

interface Props {
  plugins: PluginEntry[]
}

const columns: EuiBasicTableColumn<PluginEntry>[] = [
  {
    field: 'component',
    name: 'Plugin',
  },
  {
    field: 'version',
    name: 'Version',
    width: '160px',
    render: (v: string) => v || <span style={{ color: 'var(--euiColorSubduedText)' }}>—</span>,
  },
]

export default function Plugins({ plugins }: Props) {
  if (plugins.length === 0) return null

  return (
    <EuiBasicTable
      items={plugins}
      columns={columns}
    />
  )
}
