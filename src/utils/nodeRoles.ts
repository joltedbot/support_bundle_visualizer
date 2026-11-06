import type { NodeInfo, NodeRole } from '../parsers/types'

const ROLE_PRIORITY: Record<string, number> = {
  master:               1,
  ml:                   2,
  ingest:               3,
  transform:            4,
  coordinating:         5,
  remote_cluster_client: 5,
  data_hot:             6,
  data_warm:            7,
  data_cold:            8,
  data_frozen:          9,
}

const DATA_ROLES = new Set<NodeRole>(['data_hot', 'data_warm', 'data_cold', 'data_frozen'])

export const UNKNOWN_AZ_LABEL = 'Unknown AZ'

export function groupNodesByAZ(nodes: NodeInfo[]): Map<string, NodeInfo[]> | null {
  const hasAny = nodes.some(n => n.az)
  if (!hasAny) return null

  const buckets = new Map<string, NodeInfo[]>()
  for (const node of nodes) {
    const key = node.az ?? UNKNOWN_AZ_LABEL
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = []
      buckets.set(key, bucket)
    }
    bucket.push(node)
  }

  const sorted = new Map(
    Array.from(buckets.entries()).sort(([a], [b]) => {
      if (a === UNKNOWN_AZ_LABEL) return 1
      if (b === UNKNOWN_AZ_LABEL) return -1
      return a.localeCompare(b)
    })
  )
  return sorted
}

export interface SummaryEntry {
  tier: string
  label: string
  count: number
  shared?: boolean
}

const SUMMARY_ORDER: { tier: string; label: string }[] = [
  { tier: 'master',       label: 'Master' },
  { tier: 'ingest',       label: 'Ingest' },
  { tier: 'ml',           label: 'ML' },
  { tier: 'transform',    label: 'Transform' },
  { tier: 'coordinating', label: 'Coordinating' },
  { tier: 'hot',          label: 'Hot' },
  { tier: 'warm',         label: 'Warm' },
  { tier: 'cold',         label: 'Cold' },
  { tier: 'frozen',       label: 'Frozen' },
]

export function buildSummaryBar(nodes: NodeInfo[]): SummaryEntry[] {
  const counts: Record<string, number> = {}

  for (const node of nodes) {
    const dataRole = node.roles.find(r => DATA_ROLES.has(r))
    if (dataRole) {
      const tierKey = dataRole.replace('data_', '')
      counts[tierKey] = (counts[tierKey] ?? 0) + 1
    } else {
      let bestKey = 'coordinating'
      let bestPriority = 99
      for (const role of node.roles) {
        const key = role === 'remote_cluster_client' ? 'coordinating' : role
        const p = ROLE_PRIORITY[key] ?? 99
        if (p < bestPriority) { bestPriority = p; bestKey = key }
      }
      counts[bestKey] = (counts[bestKey] ?? 0) + 1
    }
  }

  const hasDedicatedMaster = nodes.some(n => n.tier === 'master')
  const hasSharedMaster = !hasDedicatedMaster && nodes.some(n => n.roles.includes('master'))

  const result: SummaryEntry[] = []
  for (const { tier, label } of SUMMARY_ORDER) {
    if (tier === 'master') {
      if (hasDedicatedMaster) {
        result.push({ tier, label, count: counts['master'] ?? 0 })
      } else if (hasSharedMaster) {
        result.push({ tier, label, count: 0, shared: true })
      }
    } else {
      const count = counts[tier] ?? 0
      if (count > 0) result.push({ tier, label, count })
    }
  }
  return result
}

// ─── Topology placement (vertical top-to-bottom order inside a column) ───────

export type PlacementTier = 'master' | 'ingest' | 'hot' | 'warm' | 'cold' | 'frozen' | 'ml'

/** Top-to-bottom display order of sections inside a topology column. */
export const PLACEMENT_ORDER: PlacementTier[] = ['master', 'ingest', 'hot', 'warm', 'cold', 'frozen', 'ml']

/** Section for one node, ignoring the cluster-wide tiebreaker exception. */
function basePlacement(node: NodeInfo): PlacementTier {
  const roles = node.roles
  // Hot is the pricing tier and must stay visible: any hot node is Hot, whatever else it does.
  if (roles.includes('data_hot')) return 'hot'
  if (roles.includes('master')) return 'master'
  if (roles.includes('ingest') || roles.includes('coordinating')) return 'ingest'
  if (roles.includes('data_warm')) return 'warm'
  if (roles.includes('data_cold')) return 'cold'
  if (roles.includes('data_frozen')) return 'frozen'
  if (roles.includes('ml')) return 'ml'
  // No recognised role (e.g. only transform / remote_cluster_client): coordinating-only node.
  return 'ingest'
}

/**
 * Section for every node, keyed by node id. Cluster-wide because of one exception:
 * in a shared Hot/Master cluster (two or more master-eligible Hot nodes plus exactly
 * one master-only tiebreaker) the tiebreaker ranks with the Hot nodes.
 */
export function computePlacements(nodes: NodeInfo[]): Map<string, PlacementTier> {
  const placements = new Map<string, PlacementTier>()
  for (const n of nodes) placements.set(n.id, basePlacement(n))

  // Tiebreaker: a strictly master-only node (no data, ml or ingest role).
  const masterOnly = nodes.filter(n =>
    n.tier === 'master' && !n.roles.includes('ml') && !n.roles.includes('ingest') && !n.roles.includes('coordinating'))
  const hotMasterEligible = nodes.filter(n => n.roles.includes('data_hot') && n.roles.includes('master')).length
  if (masterOnly.length === 1 && hotMasterEligible >= 2) {
    placements.set(masterOnly[0].id, 'hot')
  }
  return placements
}

/** Nodes in display order: by section, then by name (numeric-aware) within a section. */
export function sortNodesByPlacement(nodes: NodeInfo[], placements: Map<string, PlacementTier>): NodeInfo[] {
  const rank = (n: NodeInfo) => PLACEMENT_ORDER.indexOf(placements.get(n.id) ?? basePlacement(n))
  return [...nodes].sort((a, b) =>
    rank(a) - rank(b) || a.name.localeCompare(b.name, undefined, { numeric: true }),
  )
}

export const SELF_HOSTED_LABEL = 'Self Hosted'

export interface TopologyColumn {
  label: string
  nodes: NodeInfo[]
}

/**
 * Columns for the topology view: one per AZ (name order, 'Unknown AZ' last when some
 * nodes lack an AZ), or a single 'Self Hosted' column when no node has an AZ.
 */
export function buildTopologyColumns(nodes: NodeInfo[]): TopologyColumn[] {
  const azGroups = groupNodesByAZ(nodes)
  if (!azGroups) return nodes.length > 0 ? [{ label: SELF_HOSTED_LABEL, nodes }] : []
  return Array.from(azGroups.entries()).map(([label, azNodes]) => ({ label, nodes: azNodes }))
}
