import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiPanel,
  EuiBadge,
  EuiText,
  EuiProgress,
  EuiSpacer,
} from '@elastic/eui'
import type { NodeInfo } from '../parsers/types'
import { resourceColor } from '../utils/format'

interface Props {
  nodes: NodeInfo[]
}

const TIER_ORDER = ['master', 'hot', 'warm', 'cold', 'frozen', 'coordinating', 'mixed'] as const

const TIER_COLORS: Record<string, string> = {
  master: '#9b59b6',
  hot: '#e74c3c',
  warm: '#e67e22',
  cold: '#3498db',
  frozen: '#1abc9c',
  coordinating: '#95a5a6',
  mixed: '#7f8c8d',
}

function tierLabel(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1)
}

function NodeCard({ node }: { node: NodeInfo }) {
  const heapColor =
    node.heapPercent !== undefined
      ? resourceColor(node.heapPercent, 75, 85)
      : undefined
  const diskColor =
    node.diskUsedPercent !== undefined
      ? resourceColor(node.diskUsedPercent, 70, 85)
      : undefined
  const cpuColor =
    node.cpuPercent !== undefined
      ? resourceColor(node.cpuPercent, 50, 80)
      : undefined

  return (
    <EuiPanel paddingSize="s" style={{ minWidth: 220, maxWidth: 280 }}>
      <EuiFlexGroup justifyContent="spaceBetween" alignItems="center" gutterSize="xs" responsive={false}>
        <EuiFlexItem>
          <EuiText size="s">
            <strong
              title={node.name}
              style={{
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 160,
              }}
            >
              {node.name}
            </strong>
          </EuiText>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiBadge color={TIER_COLORS[node.tier] ?? '#7f8c8d'}>
            {tierLabel(node.tier)}
          </EuiBadge>
        </EuiFlexItem>
      </EuiFlexGroup>

      {node.az && (
        <EuiText size="xs" color="subdued">
          AZ: {node.az}
        </EuiText>
      )}

      <EuiSpacer size="xs" />

      {node.heapPercent !== undefined && (
        <div style={{ marginBottom: 4 }}>
          <EuiFlexGroup justifyContent="spaceBetween" gutterSize="none" responsive={false}>
            <EuiFlexItem>
              <EuiText size="xs" color="subdued">JVM Heap</EuiText>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiText size="xs">{node.heapPercent}%</EuiText>
            </EuiFlexItem>
          </EuiFlexGroup>
          <EuiProgress value={node.heapPercent} max={100} size="s" color={heapColor} />
        </div>
      )}

      {node.diskUsedPercent !== undefined && (
        <div style={{ marginBottom: 4 }}>
          <EuiFlexGroup justifyContent="spaceBetween" gutterSize="none" responsive={false}>
            <EuiFlexItem>
              <EuiText size="xs" color="subdued">Disk Used</EuiText>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiText size="xs">{node.diskUsedPercent}%</EuiText>
            </EuiFlexItem>
          </EuiFlexGroup>
          <EuiProgress value={node.diskUsedPercent} max={100} size="s" color={diskColor} />
        </div>
      )}

      {node.cpuPercent !== undefined && (
        <div>
          <EuiFlexGroup justifyContent="spaceBetween" gutterSize="none" responsive={false}>
            <EuiFlexItem>
              <EuiText size="xs" color="subdued">CPU</EuiText>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiText size="xs">{node.cpuPercent}%</EuiText>
            </EuiFlexItem>
          </EuiFlexGroup>
          <EuiProgress value={node.cpuPercent} max={100} size="s" color={cpuColor} />
        </div>
      )}
    </EuiPanel>
  )
}

export default function Topology({ nodes }: Props) {
  if (nodes.length === 0) return null

  // Group nodes by tier in defined order
  const grouped = new Map<string, NodeInfo[]>()
  for (const tier of TIER_ORDER) {
    const group = nodes.filter((n) => n.tier === tier)
    if (group.length > 0) grouped.set(tier, group)
  }

  return (
    <div>
      {Array.from(grouped.entries()).map(([tier, tierNodes]) => (
        <div key={tier} style={{ marginBottom: 16 }}>
          <EuiText size="xs" color="subdued" style={{ marginBottom: 8 }}>
            <strong>{tierLabel(tier)} nodes ({tierNodes.length})</strong>
          </EuiText>
          <EuiFlexGroup wrap gutterSize="s" responsive={false}>
            {tierNodes.map((node) => (
              <EuiFlexItem key={node.id} grow={false}>
                <NodeCard node={node} />
              </EuiFlexItem>
            ))}
          </EuiFlexGroup>
        </div>
      ))}
    </div>
  )
}
