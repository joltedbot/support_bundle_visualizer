import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiPanel,
  EuiBadge,
  EuiText,
  EuiProgress,
  EuiSpacer,
} from '@elastic/eui'
import type { NodeInfo, NodeRole } from '../parsers/types'
import { resourceColor, formatBytes } from '../utils/format'
import {
  buildSummaryBar,
  groupNodesByAZ,
  sortNodesByRole,
} from '../utils/nodeRoles'

interface Props {
  nodes: NodeInfo[]
}

// ─── Colours & labels ────────────────────────────────────────────────────────

const TIER_COLORS: Record<string, string> = {
  master:       '#9b59b6',
  hot:          '#e74c3c',
  warm:         '#e67e22',
  cold:         '#3498db',
  frozen:       '#1abc9c',
  coordinating: '#95a5a6',
  mixed:        '#7f8c8d',
  ml:           '#8e44ad',
  ingest:       '#16a085',
  transform:    '#d35400',
}

const ROLE_LABELS: Record<string, string> = {
  master:               'Master',
  data_hot:             'Hot',
  data_warm:            'Warm',
  data_cold:            'Cold',
  data_frozen:          'Frozen',
  ingest:               'Ingest',
  coordinating:         'Coord',
  ml:                   'ML',
  transform:            'Transform',
  remote_cluster_client: 'RCC',
}

const DATA_ROLE_TO_TIER: Partial<Record<NodeRole, string>> = {
  data_hot:    'hot',
  data_warm:   'warm',
  data_cold:   'cold',
  data_frozen: 'frozen',
}

function primaryTierFromRoles(roles: NodeRole[]): string {
  for (const r of roles) {
    if (DATA_ROLE_TO_TIER[r]) return DATA_ROLE_TO_TIER[r]!
  }
  if (roles.includes('master')) return 'master'
  if (roles.includes('ml')) return 'ml'
  if (roles.includes('ingest')) return 'ingest'
  if (roles.includes('transform')) return 'transform'
  return 'coordinating'
}

// ─── NodeCard ─────────────────────────────────────────────────────────────────

function NodeCard({ node }: { node: NodeInfo }) {
  const primaryTier = primaryTierFromRoles(node.roles)
  const primaryColor = TIER_COLORS[primaryTier] ?? '#7f8c8d'

  // Primary badge: data tier role wins; fall back to first non-rcc management role
  const primaryRole: NodeRole =
    node.roles.find(r => DATA_ROLE_TO_TIER[r]) ??
    node.roles.find(r => r !== 'remote_cluster_client') ??
    node.roles[0]
  const secondaryRoles = node.roles.filter(r => r !== primaryRole)

  const heapColor = node.heapPercent !== undefined
    ? resourceColor(node.heapPercent, 75, 85) : undefined
  const diskColor = node.diskUsedPercent !== undefined
    ? resourceColor(node.diskUsedPercent, 70, 85) : undefined
  const cpuColor = node.cpuPercent !== undefined
    ? resourceColor(node.cpuPercent, 50, 80) : undefined

  const ramStr = node.ramTotal !== undefined ? formatBytes(node.ramTotal) : null
  const diskStr = node.diskTotal !== undefined ? formatBytes(node.diskTotal) : null
  const capacityStr = [ramStr && `${ramStr} RAM`, diskStr && `${diskStr} disk`]
    .filter(Boolean).join(' · ')

  return (
    <EuiPanel paddingSize="s" style={{ minWidth: 220, maxWidth: 280 }}>
      {/* Name row */}
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
          <EuiFlexGroup gutterSize="xs" responsive={false} alignItems="center">
            <EuiFlexItem grow={false}>
              <EuiBadge color={primaryColor}>
                {ROLE_LABELS[primaryRole] ?? primaryTier}
              </EuiBadge>
            </EuiFlexItem>
            {secondaryRoles.map(r => (
              <EuiFlexItem grow={false} key={r}>
                <EuiBadge color={TIER_COLORS[DATA_ROLE_TO_TIER[r as NodeRole] ?? r] ?? '#555'}>
                  {ROLE_LABELS[r] ?? r}
                </EuiBadge>
              </EuiFlexItem>
            ))}
          </EuiFlexGroup>
        </EuiFlexItem>
      </EuiFlexGroup>

      {/* Capacity line */}
      {capacityStr && (
        <EuiText size="xs" color="subdued" style={{ marginTop: 2 }}>
          {capacityStr}
        </EuiText>
      )}

      <EuiSpacer size="xs" />

      {/* Progress bars */}
      {node.heapPercent !== undefined && (
        <div style={{ marginBottom: 4 }}>
          <EuiFlexGroup justifyContent="spaceBetween" gutterSize="none" responsive={false}>
            <EuiFlexItem><EuiText size="xs" color="subdued">JVM Heap</EuiText></EuiFlexItem>
            <EuiFlexItem grow={false}><EuiText size="xs">{node.heapPercent}%</EuiText></EuiFlexItem>
          </EuiFlexGroup>
          <EuiProgress value={node.heapPercent} max={100} size="s" color={heapColor} />
        </div>
      )}

      {node.diskUsedPercent !== undefined && (
        <div style={{ marginBottom: 4 }}>
          <EuiFlexGroup justifyContent="spaceBetween" gutterSize="none" responsive={false}>
            <EuiFlexItem><EuiText size="xs" color="subdued">Disk Used</EuiText></EuiFlexItem>
            <EuiFlexItem grow={false}><EuiText size="xs">{node.diskUsedPercent}%</EuiText></EuiFlexItem>
          </EuiFlexGroup>
          <EuiProgress value={node.diskUsedPercent} max={100} size="s" color={diskColor} />
        </div>
      )}

      {node.cpuPercent !== undefined && (
        <div>
          <EuiFlexGroup justifyContent="spaceBetween" gutterSize="none" responsive={false}>
            <EuiFlexItem><EuiText size="xs" color="subdued">CPU</EuiText></EuiFlexItem>
            <EuiFlexItem grow={false}><EuiText size="xs">{node.cpuPercent}%</EuiText></EuiFlexItem>
          </EuiFlexGroup>
          <EuiProgress value={node.cpuPercent} max={100} size="s" color={cpuColor} />
        </div>
      )}
    </EuiPanel>
  )
}

// ─── AZ section header ────────────────────────────────────────────────────────

function AZHeader({ az, nodes }: { az: string; nodes: NodeInfo[] }) {
  const miniBar = buildSummaryBar(nodes)
  const miniStr = miniBar
    .map(e => e.shared ? 'Master: Shared' : `${e.count} ${e.label}`)
    .join(' · ')

  return (
    <EuiText size="xs" color="subdued" style={{ marginBottom: 8 }}>
      <strong>{az}</strong>
      {' — '}
      {nodes.length} node{nodes.length !== 1 ? 's' : ''}
      {miniStr && <span style={{ fontWeight: 'normal' }}> · {miniStr}</span>}
    </EuiText>
  )
}

// ─── Summary bar ─────────────────────────────────────────────────────────────

function SummaryBar({ nodes }: { nodes: NodeInfo[] }) {
  const entries = buildSummaryBar(nodes)
  if (entries.length === 0) return null

  return (
    <EuiFlexGroup gutterSize="s" wrap responsive={false} style={{ marginBottom: 16 }}>
      {entries.map((e) => (
        <EuiFlexItem grow={false} key={e.tier}>
          <EuiBadge color="hollow">
            {e.shared ? 'Master: Shared' : `${e.label}: ${e.count}`}
          </EuiBadge>
        </EuiFlexItem>
      ))}
    </EuiFlexGroup>
  )
}

// ─── Node group (AZ groups) ───────────────────────────────────────────────────

function NodeGroup({ label, nodes }: { label: string; nodes: NodeInfo[] }) {
  const sorted = sortNodesByRole(nodes)
  return (
    <div style={{ marginBottom: 16 }}>
      <AZHeader az={label} nodes={nodes} />
      <EuiFlexGroup wrap gutterSize="s" responsive={false}>
        {sorted.map((node) => (
          <EuiFlexItem key={node.id} grow={false}>
            <NodeCard node={node} />
          </EuiFlexItem>
        ))}
      </EuiFlexGroup>
    </div>
  )
}

// ─── Tier fallback grouping (when no AZ data) ────────────────────────────────

const TIER_FALLBACK_ORDER = ['master', 'ml', 'ingest', 'transform', 'coordinating', 'hot', 'warm', 'cold', 'frozen', 'mixed'] as const

function TierFallbackView({ nodes }: { nodes: NodeInfo[] }) {
  const grouped = new Map<string, NodeInfo[]>()
  for (const tier of TIER_FALLBACK_ORDER) {
    const group = nodes.filter((n) => n.tier === tier)
    if (group.length > 0) grouped.set(tier, group)
  }

  return (
    <div>
      {Array.from(grouped.entries()).map(([tier, tierNodes]) => (
        <div key={tier} style={{ marginBottom: 16 }}>
          <EuiText size="xs" color="subdued" style={{ marginBottom: 8 }}>
            <strong>{ROLE_LABELS[tier] ?? tier} nodes ({tierNodes.length})</strong>
          </EuiText>
          <EuiFlexGroup wrap gutterSize="s" responsive={false}>
            {sortNodesByRole(tierNodes).map((node) => (
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

// ─── Main component ───────────────────────────────────────────────────────────

export default function Topology({ nodes }: Props) {
  if (nodes.length === 0) return null

  const azGroups = groupNodesByAZ(nodes)

  return (
    <div>
      <SummaryBar nodes={nodes} />

      {azGroups ? (
        Array.from(azGroups.entries()).map(([az, azNodes]) => (
          <NodeGroup key={az} label={az} nodes={azNodes} />
        ))
      ) : (
        <TierFallbackView nodes={nodes} />
      )}
    </div>
  )
}
