import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiText,
  EuiProgress,
  EuiPanel,
} from '@elastic/eui'
import type { NodeInfo } from '../parsers/types'
import { resourceColor } from '../utils/format'

interface Props {
  nodes: NodeInfo[]
}

function StatBar({
  label,
  value,
  warn,
  crit,
}: {
  label: string
  value: number | undefined
  warn: number
  crit: number
}) {
  if (value === undefined) return null
  const color = resourceColor(value, warn, crit)
  return (
    <div style={{ marginBottom: 4 }}>
      <EuiFlexGroup justifyContent="spaceBetween" gutterSize="none" responsive={false}>
        <EuiFlexItem>
          <EuiText size="xs" color="subdued">{label}</EuiText>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiText size="xs">{value}%</EuiText>
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiProgress value={value} max={100} size="s" color={color} />
    </div>
  )
}

export default function ResourceHealth({ nodes }: Props) {
  const activeNodes = nodes.filter(
    (n) =>
      n.heapPercent !== undefined ||
      n.diskUsedPercent !== undefined ||
      n.cpuPercent !== undefined
  )

  if (activeNodes.length === 0) return null

  return (
    <EuiFlexGroup wrap gutterSize="m" responsive={false}>
      {activeNodes.map((node) => (
        <EuiFlexItem key={node.id} grow={false} style={{ minWidth: 240, maxWidth: 300 }}>
          <EuiPanel paddingSize="s">
            <EuiText size="s">
              <strong
                title={node.name}
                style={{
                  display: 'block',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginBottom: 8,
                }}
              >
                {node.name}
              </strong>
            </EuiText>
            <StatBar label="JVM Heap" value={node.heapPercent} warn={75} crit={85} />
            <StatBar label="Disk Used" value={node.diskUsedPercent} warn={70} crit={85} />
            <StatBar label="CPU" value={node.cpuPercent} warn={50} crit={80} />
          </EuiPanel>
        </EuiFlexItem>
      ))}
    </EuiFlexGroup>
  )
}
