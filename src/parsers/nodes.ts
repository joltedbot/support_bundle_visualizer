import { parseJsonFile, getTextFile } from '../utils/bundleReader'
import type { NodeInfo, NodeRole } from './types'

interface NodesJsonNode {
  name?: string
  ip?: string
  roles?: string[]
  attributes?: Record<string, string>
  os?: { available_processors?: number }
}

interface NodesJson {
  nodes?: Record<string, NodesJsonNode>
}

interface NodesStatsJson {
  nodes?: Record<string, {
    name?: string
    jvm?: { mem?: { heap_used_percent?: number } }
    process?: { cpu?: { percent?: number } }
    fs?: { total?: { total_in_bytes?: number; free_in_bytes?: number; available_in_bytes?: number } }
    os?: { mem?: { total_in_bytes?: number } }
  }>
}

const KNOWN_ROLES: Set<NodeRole> = new Set([
  'master', 'data_hot', 'data_warm', 'data_cold', 'data_frozen',
  'ingest', 'coordinating', 'ml', 'transform', 'remote_cluster_client',
])

function normalizeRole(role: string): NodeRole | null {
  // ES uses 'master' for master-eligible, 'data' for generic data
  if (role === 'data') return 'data_hot' // treat generic data as hot
  if (KNOWN_ROLES.has(role as NodeRole)) return role as NodeRole
  return null
}

function determineTier(roles: NodeRole[]): NodeInfo['tier'] {
  const hasMaster = roles.includes('master')
  const hasDataHot = roles.includes('data_hot')
  const hasDataWarm = roles.includes('data_warm')
  const hasDataCold = roles.includes('data_cold')
  const hasDataFrozen = roles.includes('data_frozen')
  const dataRoles = [hasDataHot, hasDataWarm, hasDataCold, hasDataFrozen].filter(Boolean)

  if (hasMaster && dataRoles.length === 0) return 'master'
  if (dataRoles.length > 1) return 'mixed'
  if (hasDataHot) return 'hot'
  if (hasDataWarm) return 'warm'
  if (hasDataCold) return 'cold'
  if (hasDataFrozen) return 'frozen'
  // No data roles, no master
  return 'coordinating'
}

/**
 * Parse cat/cat_nodeattrs.txt to build a map of node name → AZ.
 * Looks for attr = availability_zone or zone or aws_availability_zone.
 */
function parseNodeAZMap(content: string): Map<string, string> {
  const azMap = new Map<string, string>()
  const lines = content.split('\n')
  // First line is header: node id pid host ip port attr value
  for (const line of lines.slice(1)) {
    const parts = line.trim().split(/\s+/)
    if (parts.length < 5) continue
    const nodeName = parts[0]
    const attr = parts[3]
    const value = parts[4]
    if (
      attr === 'availability_zone' ||
      attr === 'zone' ||
      attr === 'aws_availability_zone' ||
      attr === 'rack_id'
    ) {
      azMap.set(nodeName, value)
    }
  }
  return azMap
}

/**
 * Parse cat/cat_nodes.txt and return a map of node name → resource stats.
 * cat_nodes columns (from the Hinge bundle):
 * n nodeId i v role m d dup hp cpu load_1m load_5m load_15m iic sfc sqc scc
 * where: n=name, nodeId=id, i=ip, v=version, role=role, m=master, d=disk.total,
 *        dup=disk.used_percent, hp=heap.percent, cpu=cpu
 */
function parseCatNodes(content: string): Map<string, { heapPercent?: number; cpuPercent?: number; diskTotal?: number; diskAvail?: number }> {
  const statMap = new Map<string, { heapPercent?: number; cpuPercent?: number; diskTotal?: number; diskAvail?: number }>()
  const lines = content.split('\n').filter(l => l.trim())
  if (lines.length < 2) return statMap

  // Header is the first line
  const header = lines[0].trim().split(/\s+/)
  const nameIdx = header.indexOf('n')
  const hpIdx = header.indexOf('hp')
  const cpuIdx = header.indexOf('cpu')

  if (nameIdx === -1) return statMap

  for (const line of lines.slice(1)) {
    const parts = line.trim().split(/\s+/)
    if (parts.length <= nameIdx) continue
    const name = parts[nameIdx]
    const heapRaw = hpIdx !== -1 && hpIdx < parts.length ? parseFloat(parts[hpIdx]) : NaN
    const cpuRaw = cpuIdx !== -1 && cpuIdx < parts.length ? parseFloat(parts[cpuIdx]) : NaN
    statMap.set(name, {
      heapPercent: isNaN(heapRaw) ? undefined : heapRaw,
      cpuPercent: isNaN(cpuRaw) ? undefined : cpuRaw,
    })
  }
  return statMap
}

/**
 * Parse nodes from nodes.json, nodes_stats.json, cat/cat_nodes.txt, and cat/cat_nodeattrs.txt.
 */
export function parseNodes(files: Map<string, string>): NodeInfo[] {
  const nodesJson = parseJsonFile<NodesJson>(files, 'nodes.json')
  const nodesStatsJson = parseJsonFile<NodesStatsJson>(files, 'nodes_stats.json')
  const nodeAttrsContent = getTextFile(files, 'cat/cat_nodeattrs.txt')
  const catNodesContent = getTextFile(files, 'cat/cat_nodes.txt')

  if (!nodesJson?.nodes) return []

  // Build AZ map by node name
  const azMap = nodeAttrsContent ? parseNodeAZMap(nodeAttrsContent) : new Map<string, string>()

  // Build stats map by node id from nodes_stats
  const statsById = new Map<string, {
    heapPercent?: number
    cpuPercent?: number
    diskTotal?: number
    diskAvail?: number
    ramTotal?: number
  }>()

  if (nodesStatsJson?.nodes) {
    for (const [id, node] of Object.entries(nodesStatsJson.nodes)) {
      const heapPercent = node.jvm?.mem?.heap_used_percent
      const cpuPercent = node.process?.cpu?.percent
      const fsTotalBytes = node.fs?.total?.total_in_bytes
      const fsFreeBytes = node.fs?.total?.free_in_bytes ?? node.fs?.total?.available_in_bytes
      const ramTotal = node.os?.mem?.total_in_bytes

      let diskTotal: number | undefined
      let diskAvail: number | undefined
      if (fsTotalBytes !== undefined) diskTotal = fsTotalBytes
      if (fsFreeBytes !== undefined) diskAvail = fsFreeBytes

      statsById.set(id, { heapPercent, cpuPercent, diskTotal, diskAvail, ramTotal })
    }
  }

  // Fallback: cat_nodes stats by name
  const catNodeStats = catNodesContent ? parseCatNodes(catNodesContent) : new Map<string, { heapPercent?: number; cpuPercent?: number }>()

  const result: NodeInfo[] = []

  for (const [id, node] of Object.entries(nodesJson.nodes)) {
    const name = node.name ?? id
    const ip = node.ip ?? ''

    // Map roles
    const rawRoles = node.roles ?? []
    const roles: NodeRole[] = rawRoles
      .map(normalizeRole)
      .filter((r): r is NodeRole => r !== null)

    const tier = determineTier(roles)

    // AZ from nodeattrs
    const az = azMap.get(name)

    // Resource stats: prefer nodes_stats, fall back to cat_nodes
    let stats = statsById.get(id)
    if (!stats) {
      const catStats = catNodeStats.get(name)
      if (catStats) {
        stats = {
          heapPercent: catStats.heapPercent,
          cpuPercent: catStats.cpuPercent,
        }
      }
    }

    // Calculate diskUsedPercent
    let diskUsedPercent: number | undefined
    if (stats?.diskTotal !== undefined && stats.diskAvail !== undefined && stats.diskTotal > 0) {
      diskUsedPercent = ((stats.diskTotal - stats.diskAvail) / stats.diskTotal) * 100
    }

    const instanceConfiguration = node.attributes?.instance_configuration

    result.push({
      id,
      name,
      ip,
      roles,
      tier,
      az,
      instanceConfiguration,
      heapPercent: stats?.heapPercent,
      cpuPercent: stats?.cpuPercent,
      diskUsedPercent,
      diskTotal: stats?.diskTotal,
      diskAvail: stats?.diskAvail,
      ramTotal: stats?.ramTotal,
      availableProcessors: node.os?.available_processors,
    })
  }

  return result
}
