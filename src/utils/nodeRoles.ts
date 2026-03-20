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

export function getNodeSortPriority(node: NodeInfo): number {
  const dataRole = node.roles.find(r => DATA_ROLES.has(r))
  if (dataRole) return ROLE_PRIORITY[dataRole] ?? 99
  const highest = node.roles.reduce((best, r) => {
    const p = ROLE_PRIORITY[r] ?? 99
    return p < best ? p : best
  }, 99)
  return highest
}

export function groupNodesByAZ(nodes: NodeInfo[]): Map<string, NodeInfo[]> | null {
  const hasAny = nodes.some(n => n.az)
  if (!hasAny) return null

  const buckets = new Map<string, NodeInfo[]>()
  for (const node of nodes) {
    const key = node.az ?? 'Unknown AZ'
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(node)
  }

  const sorted = new Map(
    Array.from(buckets.entries()).sort(([a], [b]) => {
      if (a === 'Unknown AZ') return 1
      if (b === 'Unknown AZ') return -1
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

export function sortNodesByRole(nodes: NodeInfo[]): NodeInfo[] {
  return [...nodes].sort((a, b) => getNodeSortPriority(a) - getNodeSortPriority(b))
}
