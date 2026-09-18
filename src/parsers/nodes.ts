import { parseJsonFile, getTextFile } from '../utils/bundleReader'
import { DISK_HIGH, DISK_ALLOC_BLOCKED, DISK_FLOOD, LOAD_PERCENT_MIN_RAM_BYTES } from '../utils/thresholds'
import type {
  NodeInfo, NodeRole, NodeHealthSignals, NodeWorkload, ThreadPoolStats,
  IndexingPressureStats, CircuitBreakerStats, GCStats,
} from './types'

interface NodesJsonNode {
  name?: string
  ip?: string
  roles?: string[]
  attributes?: Record<string, string>
  os?: { available_processors?: number; allocated_processors?: number }
}

interface NodesJson {
  nodes?: Record<string, NodesJsonNode>
}

interface NodesStatsNodeEntry {
  name?: string
  jvm?: {
    uptime_in_millis?: number
    mem?: { heap_used_percent?: number; heap_max_in_bytes?: number }
    gc?: {
      collectors?: {
        young?: { collection_count?: number; collection_time_in_millis?: number }
        old?: { collection_count?: number; collection_time_in_millis?: number }
      }
    }
  }
  process?: { cpu?: { percent?: number } }
  fs?: { total?: { total_in_bytes?: number; free_in_bytes?: number; available_in_bytes?: number } }
  os?: {
    cpu?: {
      percent?: number
      load_average?: { '1m'?: number; '5m'?: number; '15m'?: number }
    }
    mem?: { total_in_bytes?: number; used_in_bytes?: number }
    cgroup?: { memory?: { limit_in_bytes?: string; usage_in_bytes?: string } }
  }
  indices?: {
    dense_vector?: { value_count?: number; off_heap?: { total_size_bytes?: number } }
    search?: { query_total?: number; query_time_in_millis?: number }
    indexing?: {
      index_time_in_millis?: number
      delete_time_in_millis?: number
      throttle_time_in_millis?: number
    }
    merges?: { total_time_in_millis?: number }
    fielddata?: { evictions?: number; memory_size_in_bytes?: number }
    ingest?: { total?: { time_in_millis?: number } }
  }
  indexing_pressure?: {
    memory?: {
      limit_in_bytes?: number
      current?: {
        coordinating_and_primary_in_bytes?: number
        replica_in_bytes?: number
      }
      total?: {
        rejections?: {
          coordinating?: number
          primary?: number
          replica?: number
        }
        coordinating_rejections?: number
        primary_rejections?: number
        replica_rejections?: number
      }
    }
  }
  thread_pool?: Record<string, {
    threads?: number
    active?: number
    queue?: number
    rejected?: number
    largest?: number
    completed?: number
  }>
  breakers?: Record<string, {
    tripped?: number
    estimated_size_in_bytes?: number
    limit_size_in_bytes?: number
  }>
  allocations?: {
    undesired_shards?: number
    forecasted_disk_usage_in_bytes?: number
    forecasted_ingest_load?: number
  }
}

interface NodesStatsJson {
  nodes?: Record<string, NodesStatsNodeEntry>
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

const INTERESTING_THREAD_POOLS = new Set([
  'write', 'search', 'get', 'analyze', 'warmer', 'listener',
  'generic', 'management', 'force_merge', 'fetch_shard_started',
  'fetch_shard_store', 'flush', 'refresh', 'snapshot', 'snapshot_meta',
])

/**
 * Build per-node health signals from nodes_stats.json and node metadata.
 * Returns one entry per node. Called after parseNodes so nodeId is stable.
 */
export function buildNodeHealthSignals(
  files: Map<string, string>,
  nodes: NodeInfo[],
): NodeHealthSignals[] {
  const nodesStatsJson = parseJsonFile<NodesStatsJson>(files, 'nodes_stats.json')
  if (!nodesStatsJson?.nodes) return []

  const result: NodeHealthSignals[] = []

  for (const node of nodes) {
    const statsEntry = nodesStatsJson.nodes[node.id]
    if (!statsEntry) continue

    const uptimeMs = statsEntry.jvm?.uptime_in_millis ?? 0

    // ── Workload ─────────────────────────────────────────────────────────────
    let workload: NodeWorkload | null = null
    const indexingMs = statsEntry.indices?.indexing?.index_time_in_millis
    const mergeMs = statsEntry.indices?.merges?.total_time_in_millis
    const searchMs = statsEntry.indices?.search?.query_time_in_millis
    const ingestMs = statsEntry.indices?.ingest?.total?.time_in_millis
    if (uptimeMs > 0 && (indexingMs !== undefined || mergeMs !== undefined || searchMs !== undefined || ingestMs !== undefined)) {
      workload = {
        indexingPercent: indexingMs !== undefined ? Math.round(indexingMs / uptimeMs * 1000) / 10 : null,
        queryPercent: searchMs !== undefined ? Math.round(searchMs / uptimeMs * 1000) / 10 : null,
        mergePercent: mergeMs !== undefined ? Math.round(mergeMs / uptimeMs * 1000) / 10 : null,
        ingestPercent: ingestMs !== undefined ? Math.round(ingestMs / uptimeMs * 1000) / 10 : null,
      }
    }

    // ── Load percent ─────────────────────────────────────────────────────────
    const load1m = statsEntry.os?.cpu?.load_average?.['1m']
    const allocProcs = node.allocatedProcessors ?? node.availableProcessors
    const ramTotal = node.ramTotal
    const loadPercentReliable = ramTotal !== undefined && ramTotal >= LOAD_PERCENT_MIN_RAM_BYTES
    let loadPercent: number | null = null
    if (load1m !== undefined && allocProcs !== undefined && allocProcs > 0) {
      loadPercent = Math.round(load1m / allocProcs * 1000) / 10
    }

    // ── GC ───────────────────────────────────────────────────────────────────
    let gc: GCStats | null = null
    const gcCollectors = statsEntry.jvm?.gc?.collectors
    if (gcCollectors) {
      gc = {
        youngCollectionCount: gcCollectors.young?.collection_count ?? 0,
        youngCollectionTimeMs: gcCollectors.young?.collection_time_in_millis ?? 0,
        oldCollectionCount: gcCollectors.old?.collection_count ?? 0,
        oldCollectionTimeMs: gcCollectors.old?.collection_time_in_millis ?? 0,
      }
    }

    // ── Fielddata evictions ───────────────────────────────────────────────────
    const fielddataEvictions = statsEntry.indices?.fielddata?.evictions ?? null

    // ── Indexing pressure ─────────────────────────────────────────────────────
    let indexingPressure: IndexingPressureStats | null = null
    const ipMem = statsEntry.indexing_pressure?.memory
    if (ipMem) {
      const coordAndPrimary = ipMem.current?.coordinating_and_primary_in_bytes ?? 0
      const replica = ipMem.current?.replica_in_bytes ?? 0
      // Support both on-wire shapes for total rejections
      const rejCoord = ipMem.total?.rejections?.coordinating ?? ipMem.total?.coordinating_rejections ?? 0
      const rejPrimary = ipMem.total?.rejections?.primary ?? ipMem.total?.primary_rejections ?? 0
      const rejReplica = ipMem.total?.rejections?.replica ?? ipMem.total?.replica_rejections ?? 0
      indexingPressure = {
        limitInBytes: ipMem.limit_in_bytes ?? 0,
        currentCoordinatingAndPrimaryInBytes: coordAndPrimary,
        currentReplicaInBytes: replica,
        totalRejectionsCoordinating: rejCoord,
        totalRejectionsPrimary: rejPrimary,
        totalRejectionsReplica: rejReplica,
        hasRejections: rejCoord > 0 || rejPrimary > 0 || rejReplica > 0,
      }
    }

    // ── Thread pools ──────────────────────────────────────────────────────────
    const threadPools: ThreadPoolStats[] = []
    if (statsEntry.thread_pool) {
      for (const [pool, tp] of Object.entries(statsEntry.thread_pool)) {
        if (!INTERESTING_THREAD_POOLS.has(pool)) continue
        const threads = tp.threads ?? 0
        const active = tp.active ?? 0
        const queue = tp.queue ?? 0
        const rejected = tp.rejected ?? 0
        const largest = tp.largest ?? 0
        // Include only pools that have any activity worth showing
        if (threads > 0 || active > 0 || queue > 0 || rejected > 0) {
          threadPools.push({ pool, threads, active, queue, rejected, largest })
        }
      }
    }

    // ── Circuit breakers ──────────────────────────────────────────────────────
    const circuitBreakers: CircuitBreakerStats[] = []
    if (statsEntry.breakers) {
      for (const [name, br] of Object.entries(statsEntry.breakers)) {
        circuitBreakers.push({
          name,
          tripped: br.tripped ?? 0,
          estimatedSizeInBytes: br.estimated_size_in_bytes ?? 0,
          limitSizeInBytes: br.limit_size_in_bytes ?? 0,
        })
      }
    }

    // ── Allocations forecast (ES 8.17+, data nodes only) ─────────────────────
    let allocations: NodeHealthSignals['allocations']
    const rawAlloc = statsEntry.allocations
    const isDataNode = node.roles.some(r => r.startsWith('data'))
    if (!isDataNode) {
      allocations = { unavailable: 'NOT_APPLICABLE' }
    } else if (rawAlloc) {
      allocations = {
        undesiredShards: rawAlloc.undesired_shards ?? 0,
        forecastedDiskUsageInBytes: rawAlloc.forecasted_disk_usage_in_bytes ?? 0,
        forecastedIngestLoad: rawAlloc.forecasted_ingest_load ?? 0,
      }
    } else {
      allocations = { unavailable: 'REQUIRES_ES_8_17' }
    }

    result.push({
      nodeId: node.id,
      nodeName: node.name,
      workload,
      loadPercent,
      loadPercentReliable,
      indexingPressure,
      threadPools,
      circuitBreakers,
      fielddataEvictions,
      gc,
      allocations,
    })
  }

  return result
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
    heapMaxBytes?: number
    cpuPercent?: number
    diskTotal?: number
    diskAvail?: number
    ramTotal?: number
    ramUsed?: number
    offHeapBytes?: number
    jvmUptimeMs?: number
  }>()

  if (nodesStatsJson?.nodes) {
    for (const [id, node] of Object.entries(nodesStatsJson.nodes)) {
      const heapPercent = node.jvm?.mem?.heap_used_percent
      const heapMaxBytes = node.jvm?.mem?.heap_max_in_bytes
      const cpuPercent = node.os?.cpu?.percent ?? node.process?.cpu?.percent
      const fsTotalBytes = node.fs?.total?.total_in_bytes
      const fsFreeBytes = node.fs?.total?.free_in_bytes ?? node.fs?.total?.available_in_bytes
      // Prefer cgroup memory (per-container, accurate for K8s/ESS).
      // Fall back to os.mem for bare-metal where cgroup is absent or has no limit.
      const CGROUP_SENTINEL = 1e15 // anything above 1 PB is the "no limit" sentinel
      const cgroupMem = node.os?.cgroup?.memory
      const cgroupLimitRaw = cgroupMem?.limit_in_bytes
      const cgroupUsageRaw = cgroupMem?.usage_in_bytes
      const cgroupLimit = cgroupLimitRaw && cgroupLimitRaw !== 'max' ? parseInt(cgroupLimitRaw, 10) : NaN
      const cgroupUsage = cgroupUsageRaw ? parseInt(cgroupUsageRaw, 10) : NaN
      const useCgroup = !isNaN(cgroupLimit) && cgroupLimit > 0 && cgroupLimit < CGROUP_SENTINEL && !isNaN(cgroupUsage)
      const ramTotal = useCgroup ? cgroupLimit : node.os?.mem?.total_in_bytes
      const ramUsed = useCgroup ? cgroupUsage : node.os?.mem?.used_in_bytes
      const jvmUptimeMs = node.jvm?.uptime_in_millis
      const offHeapRaw = node.indices?.dense_vector?.off_heap?.total_size_bytes
      const offHeapBytes = offHeapRaw != null && offHeapRaw > 0 ? offHeapRaw : undefined

      let diskTotal: number | undefined
      let diskAvail: number | undefined
      if (fsTotalBytes !== undefined) diskTotal = fsTotalBytes
      if (fsFreeBytes !== undefined) diskAvail = fsFreeBytes

      statsById.set(id, { heapPercent, heapMaxBytes, cpuPercent, diskTotal, diskAvail, ramTotal, ramUsed, offHeapBytes, jvmUptimeMs })
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
      diskUsedPercent = Math.round(((stats.diskTotal - stats.diskAvail) / stats.diskTotal) * 1000) / 10
    }

    // Disk watermark band (null for frozen tier — disk is pre-allocated cache, not real usage)
    let diskWatermark: NodeInfo['diskWatermark'] = undefined
    if (tier !== 'frozen') {
      if (diskUsedPercent === undefined) {
        diskWatermark = null
      } else if (diskUsedPercent >= DISK_FLOOD) {
        diskWatermark = 'flood'
      } else if (diskUsedPercent >= DISK_ALLOC_BLOCKED) {
        diskWatermark = 'high'
      } else if (diskUsedPercent >= DISK_HIGH) {
        diskWatermark = 'low'
      } else {
        diskWatermark = 'healthy'
      }
    }

    const instanceConfiguration = node.attributes?.instance_configuration
    // allocated_processors is cgroup-aware (correct on Cloud); fall back to available_processors
    const allocatedProcessors = node.os?.allocated_processors ?? node.os?.available_processors

    result.push({
      id,
      name,
      ip,
      roles,
      tier,
      az,
      instanceConfiguration,
      heapPercent: stats?.heapPercent,
      heapMaxBytes: stats?.heapMaxBytes,
      cpuPercent: stats?.cpuPercent,
      diskUsedPercent,
      diskTotal: stats?.diskTotal,
      diskAvail: stats?.diskAvail,
      diskWatermark,
      ramTotal: stats?.ramTotal,
      ramUsed: stats?.ramUsed,
      offHeapBytes: stats?.offHeapBytes,
      jvmUptimeMs: stats?.jvmUptimeMs,
      availableProcessors: node.os?.available_processors,
      allocatedProcessors,
    })
  }

  return result
}
