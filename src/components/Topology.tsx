import type { ComponentProps, CSSProperties, ReactNode } from 'react'
import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiPanel,
  EuiBadge,
  EuiText,
  EuiProgress,
  EuiSpacer,
  EuiAccordion,
  EuiToolTip,
  EuiIcon,
} from '@elastic/eui'
import type { NodeInfo, NodeRole, KibanaInfo, NodeHealthSignals } from '../parsers/types'
import { resourceColor, formatBytes, formatUptime, diskUsageColor, diskUsageLabel } from '../utils/format'
import {
  HEAP_WARN, HEAP_CRIT, CPU_WARN, CPU_CRIT, HEAP_RAM_WARN_PCT, HEAP_RAM_CRIT_PCT, HEAP_RAM_MAX_BYTES,
  SHARD_COUNT_WARN_PCT, SHARD_COUNT_CRIT_PCT, BREAKER_NOTABLE_RATIO, BREAKER_WARN_PCT, BREAKER_CRIT_PCT,
  EVENT_LOOP_WARN_MS, EVENT_LOOP_CRIT_MS,
} from '../utils/thresholds'
import {
  buildSummaryBar,
  groupNodesByAZ,
  sortNodesByRole,
} from '../utils/nodeRoles'

interface Props {
  nodes: NodeInfo[]
  kibana: KibanaInfo | null
  maxShardsPerNode: number | null
  maxShardsPerNodeFrozen: number | null
  nodeHealthSignals: NodeHealthSignals[]
}

// ─── Circuit breaker helpers ──────────────────────────────────────────────────

const CB_NAMES: Record<string, string> = {
  parent:              'Parent (Total Heap Memory)',
  fielddata:           'Field Data (Heap for Field Data)',
  request:             'Request (Memory-heavy Requests)',
  inflight_requests:   'In-Flight Requests (Incoming Request Memory)',
  in_flight_requests:  'In-Flight Requests (Incoming Request Memory)',
  model_inference:     'Model Inference (ML Model Memory)',
  eql_sequence:        'EQL Sequence (EQL Query Memory)',
  accounting:          'Accounting (Untracked Memory)',
}

function cbFriendlyName(name: string): string {
  return CB_NAMES[name] ?? name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function InfoTip({ content }: { content: string }) {
  return (
    <EuiToolTip content={content}>
      <EuiIcon type="iInCircle" size="s" color="subdued" style={{ marginLeft: 4, verticalAlign: 'middle', cursor: 'help' }} />
    </EuiToolTip>
  )
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

// ─── Shared building blocks ───────────────────────────────────────────────────

type ProgressColor = ComponentProps<typeof EuiProgress>['color']

const pctOf = (part: number, whole: number): number => Math.round((part / whole) * 100)

function MetricBar({ label, valueText, pct, color, size = 's', wrapperStyle, children }: {
  label: string
  valueText: string
  pct: number
  color?: ProgressColor
  size?: ComponentProps<typeof EuiProgress>['size']
  wrapperStyle?: CSSProperties
  children?: ReactNode
}) {
  return (
    <div style={wrapperStyle}>
      <EuiFlexGroup justifyContent="spaceBetween" gutterSize="none" responsive={false}>
        <EuiFlexItem><EuiText size="xs" color="subdued">{label}</EuiText></EuiFlexItem>
        <EuiFlexItem grow={false}><EuiText size="xs">{valueText}</EuiText></EuiFlexItem>
      </EuiFlexGroup>
      <EuiProgress value={pct} max={100} size={size} color={color} />
      {children}
    </div>
  )
}

function Subtext({ children }: { children: ReactNode }) {
  return <EuiText size="xs" color="subdued" style={{ marginTop: 1 }}>{children}</EuiText>
}

// A detail line (first child) followed by an info tooltip
function InfoRow({ tip, style, children }: { tip: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <EuiFlexGroup gutterSize="none" alignItems="center" responsive={false} style={style}>
      <EuiFlexItem grow={false}>{children}</EuiFlexItem>
      <EuiFlexItem grow={false}><InfoTip content={tip} /></EuiFlexItem>
    </EuiFlexGroup>
  )
}

// ─── Node detail accordion body ───────────────────────────────────────────────

function GcDetail({ gc, jvmUptimeMs }: { gc: NonNullable<NodeHealthSignals['gc']>; jvmUptimeMs?: number }) {
  const youngPct = jvmUptimeMs ? Math.round(gc.youngCollectionTimeMs / jvmUptimeMs * 1000) / 10 : null
  const oldPct = jvmUptimeMs ? Math.round(gc.oldCollectionTimeMs / jvmUptimeMs * 1000) / 10 : null
  return (
    <div style={{ marginBottom: 4 }}>
      <InfoRow tip="The JVM periodically reclaims unused heap memory. Routine (young) GC is expected and cheap. Full (old) GC is a stop-the-world pause that briefly freezes the node — high counts or long total duration indicate heap pressure.">
        <EuiText size="xs" color="subdued"><strong>Garbage Collection</strong></EuiText>
      </InfoRow>
      <EuiText size="xs" color="subdued" style={{ marginLeft: 8 }}>
        Routine (young): {gc.youngCollectionCount} runs{youngPct !== null ? ` · ${youngPct}% of uptime` : ''}
      </EuiText>
      <EuiText size="xs" color={oldPct !== null && oldPct > 0 ? 'warning' : 'subdued'} style={{ marginLeft: 8 }}>
        Full (old): {gc.oldCollectionCount} runs{oldPct !== null ? ` · ${oldPct}% of uptime` : ''}
      </EuiText>
    </div>
  )
}

function CircuitBreakersDetail({ breakers }: { breakers: NodeHealthSignals['circuitBreakers'] }) {
  if (breakers.length === 0) return null
  const tripped = breakers.filter(cb => cb.tripped > 0)
  const notable = breakers.filter(cb =>
    cb.tripped > 0 ||
    (cb.limitSizeInBytes > 0 && (cb.estimatedSizeInBytes / cb.limitSizeInBytes) >= BREAKER_NOTABLE_RATIO)
  )
  if (notable.length === 0) return null
  return (
    <div style={{ marginTop: 4 }}>
      <InfoRow tip="Safety limits that reject requests before they exhaust JVM heap. 'Tripped' means a request was rejected with HTTP 429. Total Heap Guard fires when overall heap approaches 95% — more serious than individual breaker trips.">
        <EuiText size="xs" color={tripped.length > 0 ? 'danger' : 'subdued'}>
          <strong>Circuit Breakers{tripped.length > 0 ? ` — tripped: ${tripped.map(cb => cbFriendlyName(cb.name)).join(', ')}` : ''}</strong>
        </EuiText>
      </InfoRow>
      {notable.map(cb => {
        const pct = cb.limitSizeInBytes > 0 ? pctOf(cb.estimatedSizeInBytes, cb.limitSizeInBytes) : 0
        const barColor = cb.tripped > 0 ? 'danger' : resourceColor(pct, BREAKER_WARN_PCT, BREAKER_CRIT_PCT)
        return (
          <MetricBar
            key={cb.name}
            label={`${cbFriendlyName(cb.name)}${cb.tripped > 0 ? ` (${cb.tripped} trip${cb.tripped !== 1 ? 's' : ''})` : ''}`}
            valueText={`${pct}%`}
            pct={pct}
            color={barColor}
            size="xs"
            wrapperStyle={{ marginBottom: 3, marginLeft: 8 }}
          >
            <Subtext>{formatBytes(cb.estimatedSizeInBytes)} / {formatBytes(cb.limitSizeInBytes)}</Subtext>
          </MetricBar>
        )
      })}
    </div>
  )
}

function workloadSummary(workload: NodeHealthSignals['workload']): string {
  if (!workload) return ''
  return [
    ['Indexing', workload.indexingPercent],
    ['Query', workload.queryPercent],
    ['Merge', workload.mergePercent],
  ]
    .filter(([, pct]) => pct !== null)
    .map(([label, pct]) => `${label} ${pct}%`)
    .join(' · ')
}

function NodeDetail({ node, signals }: { node: NodeInfo; signals: NodeHealthSignals }) {
  const workloadText = workloadSummary(signals.workload)
  const rejectedPools = signals.threadPools.filter(tp => tp.rejected > 0)
  const ip = signals.indexingPressure
  return (
    <div style={{ paddingTop: 4 }}>
      {signals.gc && <GcDetail gc={signals.gc} jvmUptimeMs={node.jvmUptimeMs} />}

      {signals.fielddataEvictions !== null && signals.fielddataEvictions > 0 && (
        <InfoRow
          style={{ marginBottom: 2 }}
          tip="Fielddata was evicted from the heap cache and must be reloaded from disk on next use. Any evictions mean the fielddata cache is undersized for this node's query patterns."
        >
          <EuiText size="xs" color="subdued">Fielddata evictions: {signals.fielddataEvictions}</EuiText>
        </InfoRow>
      )}

      {rejectedPools.length > 0 && (
        <div style={{ marginBottom: 2 }}>
          <InfoRow tip="Requests were discarded when a thread pool's queue was full. Rejections cause HTTP 429 errors for callers. Each pool handles a specific category of work (search, write, etc.).">
            <EuiText size="xs" color="subdued"><strong>Thread pool rejections</strong></EuiText>
          </InfoRow>
          {rejectedPools.map(tp => (
            <EuiText key={tp.pool} size="xs" color="subdued" style={{ marginLeft: 8 }}>
              {tp.pool}: {tp.rejected} rejected
            </EuiText>
          ))}
        </div>
      )}

      {ip?.hasRejections && (
        <InfoRow
          style={{ marginBottom: 2 }}
          tip="Elasticsearch rejected indexing requests because memory used by in-flight bulk operations exceeded the indexing pressure limit. Indicates the node cannot keep up with ingest load."
        >
          <EuiText size="xs" color="subdued">
            Indexing backpressure: Coord {ip.totalRejectionsCoordinating} / Primary {ip.totalRejectionsPrimary} / Replica {ip.totalRejectionsReplica} rejections
          </EuiText>
        </InfoRow>
      )}

      {signals.loadPercent !== null && (
        <InfoRow
          style={{ marginBottom: 2 }}
          tip="1-minute CPU load average as a percentage of allocated vCPUs. Above 100% means the node is CPU-saturated. On small VMs the load reflects the host machine, not this node's container — treat as unreliable in that case."
        >
          <EuiText size="xs" color="subdued">
            System load: {signals.loadPercent}%{signals.loadPercentReliable ? '' : ' (unreliable — small VM)'}
          </EuiText>
        </InfoRow>
      )}

      {workloadText && (
        <div style={{ marginBottom: 2 }}>
          <InfoRow tip="Cumulative thread-time for each activity divided by node uptime. Values above 100% are normal on multi-core nodes — 16 threads all indexing simultaneously produce 1600% for one second of wall time. High merge % means the node is spending significant CPU compacting Lucene segments, which competes with indexing and search.">
            <EuiText size="xs" color="subdued"><strong>Thread load vs uptime</strong></EuiText>
          </InfoRow>
          <EuiText size="xs" color="subdued" style={{ marginLeft: 8 }}>
            {workloadText}
          </EuiText>
        </div>
      )}

      <CircuitBreakersDetail breakers={signals.circuitBreakers} />
    </div>
  )
}

// ─── NodeCard ─────────────────────────────────────────────────────────────────

function heapRamColorFor(node: NodeInfo): ProgressColor {
  if (node.heapMaxBytes === undefined || node.ramTotal === undefined || node.ramTotal <= 0) return undefined
  if (node.heapMaxBytes >= HEAP_RAM_MAX_BYTES) return 'danger'
  return resourceColor(pctOf(node.heapMaxBytes, node.ramTotal), HEAP_RAM_WARN_PCT, HEAP_RAM_CRIT_PCT)
}

function NodeCard({ node, maxShardsPerNode, maxShardsPerNodeFrozen, signals }: {
  node: NodeInfo
  maxShardsPerNode: number | null
  maxShardsPerNodeFrozen: number | null
  signals?: NodeHealthSignals
}) {
  const primaryRole: NodeRole =
    node.roles.find(r => DATA_ROLE_TO_TIER[r]) ??
    node.roles.find(r => r !== 'remote_cluster_client') ??
    node.roles[0]
  const secondaryRoles = node.roles.filter(r => r !== primaryRole)

  const primaryTier = DATA_ROLE_TO_TIER[primaryRole] ?? primaryRole
  const primaryColor = TIER_COLORS[primaryTier] ?? '#7f8c8d'

  const heapColor = node.heapPercent !== undefined
    ? resourceColor(node.heapPercent, HEAP_WARN, HEAP_CRIT) : undefined
  const cpuColor = node.cpuPercent !== undefined
    ? resourceColor(node.cpuPercent, CPU_WARN, CPU_CRIT) : undefined

  const vcpuStr = (node.allocatedProcessors ?? node.availableProcessors) !== undefined
    ? `${node.allocatedProcessors ?? node.availableProcessors} vCPU` : null
  const ramStr = node.ramTotal !== undefined ? formatBytes(node.ramTotal) : null
  const diskStr = node.diskTotal !== undefined ? formatBytes(node.diskTotal) : null
  const capacityStr = [vcpuStr, ramStr && `${ramStr} RAM`, diskStr && `${diskStr} disk`]
    .filter(Boolean).join(' · ')

  const diskLabel = node.diskUsedPercent !== undefined ? diskUsageLabel(node.diskUsedPercent) : null

  const shardMax = (node.tier === 'frozen' && maxShardsPerNodeFrozen != null)
    ? maxShardsPerNodeFrozen
    : (maxShardsPerNode ?? 1000)
  const shardPct = node.shardCount !== undefined && shardMax > 0 ? pctOf(node.shardCount, shardMax) : 0

  return (
    <EuiPanel paddingSize="s" style={{ minWidth: 220, maxWidth: 280 }}>
      <EuiText size="s">
        <strong
          title={node.name}
          style={{
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {node.name}
        </strong>
      </EuiText>

      <EuiFlexGroup gutterSize="xs" responsive={false} alignItems="center" wrap style={{ marginTop: 4 }}>
        <EuiFlexItem grow={false}>
          <EuiBadge color={primaryColor} style={{ fontSize: 10 }}>
            {ROLE_LABELS[primaryRole] ?? primaryTier}
          </EuiBadge>
        </EuiFlexItem>
        {secondaryRoles.map(r => (
          <EuiFlexItem grow={false} key={r}>
            <EuiBadge color={TIER_COLORS[DATA_ROLE_TO_TIER[r] ?? r] ?? '#555'} style={{ fontSize: 10 }}>
              {ROLE_LABELS[r] ?? r}
            </EuiBadge>
          </EuiFlexItem>
        ))}
      </EuiFlexGroup>

      {capacityStr && (
        <EuiText size="xs" color="subdued" style={{ marginTop: 2 }}>
          {capacityStr}
        </EuiText>
      )}

      {node.instanceConfiguration && (
        <EuiText size="xs" color="subdued" style={{ marginTop: 1, fontFamily: 'monospace' }}>
          {node.instanceConfiguration}
        </EuiText>
      )}

      <EuiSpacer size="xs" />

      {node.heapPercent !== undefined && (
        <MetricBar
          label="JVM Heap Used" valueText={`${node.heapPercent}%`} pct={node.heapPercent}
          color={heapColor} wrapperStyle={{ marginBottom: 4 }}
        />
      )}

      {node.heapMaxBytes !== undefined && node.ramTotal !== undefined && node.ramTotal > 0 && (
        <MetricBar
          label="JVM Heap / RAM"
          valueText={`${pctOf(node.heapMaxBytes, node.ramTotal)}%`}
          pct={pctOf(node.heapMaxBytes, node.ramTotal)}
          color={heapRamColorFor(node)}
          wrapperStyle={{ marginBottom: 4 }}
        >
          <Subtext>{formatBytes(node.heapMaxBytes)} / {formatBytes(node.ramTotal)}</Subtext>
        </MetricBar>
      )}

      {node.ramUsed !== undefined && node.ramTotal !== undefined && node.ramTotal > 0 && (
        <MetricBar
          label="Memory Used"
          valueText={`${pctOf(node.ramUsed, node.ramTotal)}%`}
          pct={pctOf(node.ramUsed, node.ramTotal)}
          color="primary"
          wrapperStyle={{ marginBottom: 4 }}
        >
          <Subtext>{formatBytes(node.ramUsed)} / {formatBytes(node.ramTotal)}</Subtext>
        </MetricBar>
      )}

      {node.offHeapBytes !== undefined && (
        <EuiText size="xs" color="subdued" style={{ marginBottom: 4 }}>
          Off-heap (vec): {formatBytes(node.offHeapBytes)}
        </EuiText>
      )}

      {node.diskUsedPercent !== undefined && node.tier !== 'frozen' && (
        <MetricBar
          label="Disk Used" valueText={`${node.diskUsedPercent}%`} pct={node.diskUsedPercent}
          color={diskUsageColor(node.diskUsedPercent)} wrapperStyle={{ marginBottom: 4 }}
        >
          {diskLabel && (
            <EuiText size="xs" color="warning" style={{ marginTop: 1 }}>
              ⚠ {diskLabel}
            </EuiText>
          )}
        </MetricBar>
      )}

      {node.tier === 'frozen' && node.sharedCacheSizeBytes !== undefined && (
        <EuiText size="xs" color="subdued" style={{ marginBottom: 4 }}>
          Snapshot Disk Cache: {formatBytes(node.sharedCacheSizeBytes)}
        </EuiText>
      )}

      {node.tier === 'frozen' && node.snapshotDataBytes !== undefined && (
        <EuiText size="xs" color="subdued" style={{ marginBottom: 4 }}>
          Searchable Snapshots: {formatBytes(node.snapshotDataBytes)}
        </EuiText>
      )}

      {node.shardCount !== undefined && (
        <MetricBar
          label="Shards" valueText={`${shardPct}%`} pct={shardPct}
          color={resourceColor(shardPct, SHARD_COUNT_WARN_PCT, SHARD_COUNT_CRIT_PCT)}
          wrapperStyle={{ marginBottom: 4 }}
        >
          <Subtext>{node.shardCount} / {shardMax}</Subtext>
        </MetricBar>
      )}

      {node.cpuPercent !== undefined && (
        <MetricBar label="CPU" valueText={`${node.cpuPercent}%`} pct={node.cpuPercent} color={cpuColor} />
      )}

      {signals !== undefined && (
        <EuiAccordion
          id={`node-detail-${node.id}`}
          buttonContent="Node detail"
          initialIsOpen={false}
          paddingSize="none"
          style={{ marginTop: 6 }}
        >
          <NodeDetail node={node} signals={signals} />
        </EuiAccordion>
      )}

      {node.jvmUptimeMs !== undefined && (
        <EuiText size="xs" color="subdued" style={{ marginTop: 4 }}>
          Uptime: {formatUptime(node.jvmUptimeMs)}
        </EuiText>
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

function NodeGroup({ label, nodes, maxShardsPerNode, maxShardsPerNodeFrozen, signalsMap }: {
  label: string
  nodes: NodeInfo[]
  maxShardsPerNode: number | null
  maxShardsPerNodeFrozen: number | null
  signalsMap: Map<string, NodeHealthSignals>
}) {
  const sorted = sortNodesByRole(nodes)
  return (
    <div style={{ marginBottom: 16 }}>
      <AZHeader az={label} nodes={nodes} />
      <EuiFlexGroup wrap gutterSize="s" responsive={false}>
        {sorted.map((node) => (
          <EuiFlexItem key={node.id} grow={false}>
            <NodeCard
              node={node}
              maxShardsPerNode={maxShardsPerNode}
              maxShardsPerNodeFrozen={maxShardsPerNodeFrozen}
              signals={signalsMap.get(node.id)}
            />
          </EuiFlexItem>
        ))}
      </EuiFlexGroup>
    </div>
  )
}

// ─── Tier fallback grouping (when no AZ data) ────────────────────────────────

const TIER_FALLBACK_ORDER = ['master', 'ml', 'ingest', 'transform', 'coordinating', 'hot', 'warm', 'cold', 'frozen', 'mixed'] as const

function TierFallbackView({ nodes, maxShardsPerNode, maxShardsPerNodeFrozen, signalsMap }: {
  nodes: NodeInfo[]
  maxShardsPerNode: number | null
  maxShardsPerNodeFrozen: number | null
  signalsMap: Map<string, NodeHealthSignals>
}) {
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
                <NodeCard
                  node={node}
                  maxShardsPerNode={maxShardsPerNode}
                  maxShardsPerNodeFrozen={maxShardsPerNodeFrozen}
                  signals={signalsMap.get(node.id)}
                />
              </EuiFlexItem>
            ))}
          </EuiFlexGroup>
        </div>
      ))}
    </div>
  )
}

// ─── KibanaCard ───────────────────────────────────────────────────────────────

function eventLoopColor(ms: number): 'subdued' | 'warning' | 'danger' {
  if (ms >= EVENT_LOOP_CRIT_MS) return 'danger'
  if (ms >= EVENT_LOOP_WARN_MS) return 'warning'
  return 'subdued'
}

function KibanaCard({ kibana }: { kibana: KibanaInfo }) {
  const statusColor = kibana.status === 'green' ? '#017d73' : kibana.status === 'yellow' ? '#f5a700' : kibana.status === 'red' ? '#bd271e' : '#69707d'
  const heapColor = kibana.heapPercent !== undefined ? resourceColor(kibana.heapPercent, HEAP_WARN, HEAP_CRIT) : undefined

  return (
    <EuiPanel paddingSize="s" style={{ minWidth: 200, maxWidth: 280 }}>
      <EuiFlexGroup gutterSize="xs" alignItems="center" responsive={false}>
        <EuiFlexItem grow={false}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, marginRight: 4 }} />
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiText size="s" style={{ fontWeight: 600, lineHeight: 1.3 }}>
            {kibana.instanceName || 'Kibana'}
          </EuiText>
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiSpacer size="xs" />
      <EuiBadge color="#2563eb" style={{ fontSize: 10 }}>Kibana v{kibana.version}</EuiBadge>
      {kibana.heapSizeLimit !== undefined && (
        <EuiText size="xs" color="subdued" style={{ marginTop: 4 }}>
          {formatBytes(kibana.heapSizeLimit)} instance
        </EuiText>
      )}

      {kibana.heapPercent !== undefined && (
        <MetricBar
          label="JVM Heap Used" valueText={`${kibana.heapPercent}%`} pct={kibana.heapPercent}
          color={heapColor} wrapperStyle={{ marginTop: 6 }}
        >
          {kibana.heapUsed !== undefined && kibana.heapSizeLimit !== undefined && (
            <Subtext>{formatBytes(kibana.heapUsed)} / {formatBytes(kibana.heapSizeLimit)}</Subtext>
          )}
        </MetricBar>
      )}

      {kibana.eventLoopDelayMs !== undefined && (
        <EuiText size="xs" color={eventLoopColor(kibana.eventLoopDelayMs)} style={{ marginTop: 4 }}>
          Event Loop: {Math.round(kibana.eventLoopDelayMs)} ms
        </EuiText>
      )}

      {kibana.uptimeMs !== undefined && (
        <EuiText size="xs" color="subdued" style={{ marginTop: 2 }}>
          Uptime: {formatUptime(kibana.uptimeMs)}
        </EuiText>
      )}

      {kibana.responseTimeAvgMs !== undefined && kibana.concurrentConnections !== undefined && (
        <EuiText size="xs" color="subdued" style={{ marginTop: 2 }}>
          Avg resp: {Math.round(kibana.responseTimeAvgMs)} ms · {kibana.concurrentConnections} connections
        </EuiText>
      )}
    </EuiPanel>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Topology({ nodes, kibana, maxShardsPerNode, maxShardsPerNodeFrozen, nodeHealthSignals }: Props) {
  if (nodes.length === 0 && !kibana) return null

  const signalsMap = new Map<string, NodeHealthSignals>()
  for (const sig of nodeHealthSignals) {
    signalsMap.set(sig.nodeId, sig)
  }

  const azGroups = nodes.length > 0 ? groupNodesByAZ(nodes) : null

  return (
    <div>
      {nodes.length > 0 && <SummaryBar nodes={nodes} />}

      {nodes.length > 0 && (azGroups ? (
        Array.from(azGroups.entries()).map(([az, azNodes]) => (
          <NodeGroup key={az} label={az} nodes={azNodes} maxShardsPerNode={maxShardsPerNode} maxShardsPerNodeFrozen={maxShardsPerNodeFrozen} signalsMap={signalsMap} />
        ))
      ) : (
        <TierFallbackView nodes={nodes} maxShardsPerNode={maxShardsPerNode} maxShardsPerNodeFrozen={maxShardsPerNodeFrozen} signalsMap={signalsMap} />
      ))}

      {kibana && (
        <>
          <EuiSpacer size="m" />
          <EuiText size="xs" color="subdued" style={{ marginBottom: 6 }}>
            <strong>Kibana</strong>
          </EuiText>
          <EuiFlexGroup gutterSize="m" wrap responsive={false}>
            <EuiFlexItem grow={false}>
              <KibanaCard kibana={kibana} />
            </EuiFlexItem>
          </EuiFlexGroup>
        </>
      )}
    </div>
  )
}
