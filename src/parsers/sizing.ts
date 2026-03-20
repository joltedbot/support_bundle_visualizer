import { parseJsonFile } from '../utils/bundleReader'
import type { IndexInfo, SizingMetrics, RetentionBucket } from './types'

interface NodeStatEntry {
  jvm?: { uptime_in_millis?: number }
  indices?: {
    search?: { query_total?: number }
  }
}

interface NodesStatsJson {
  nodes?: Record<string, NodeStatEntry>
}

interface ILMPhase {
  min_age?: string
}

interface ILMPolicyEntry {
  policy?: {
    phases?: {
      delete?: ILMPhase
    }
  }
}

/**
 * Convert an ILM min_age string (e.g. "30d", "180d", "6M", "24h") to days.
 * Returns null for unparseable or zero values.
 */
function parseMinAgeDays(minAge: string): number | null {
  if (!minAge) return null
  const lower = minAge.trim().toLowerCase()
  const match = lower.match(/^(\d+(?:\.\d+)?)\s*([a-z]+)$/)
  if (!match) return null
  const value = parseFloat(match[1])
  const unit = match[2]
  if (isNaN(value) || value <= 0) return null
  switch (unit) {
    case 'd': return value
    case 'h': return value / 24
    case 'm': return value / 1440
    case 'M': return value * 30  // approximate
    case 'y': return value * 365
    default: return null
  }
}

/**
 * Parse nodes_stats.json and commercial/ilm_policies.json + already-parsed indices
 * to produce sizing estimates: avg QPS, ingest rate, and data retention distribution.
 * Returns null if neither nodes_stats nor ILM policy data is available.
 */
export function parseSizing(files: Map<string, string>, indices: IndexInfo[]): SizingMetrics | null {
  const nodesStatsRaw = parseJsonFile<NodesStatsJson>(files, 'nodes_stats.json')
  const ilmPoliciesRaw = parseJsonFile<Record<string, ILMPolicyEntry>>(files, 'commercial/ilm_policies.json')

  if (!nodesStatsRaw && !ilmPoliciesRaw) return null

  // --- Query rate ---
  let avgQueryRateQPS: number | null = null
  let nodeUptimeDays: number | null = null

  if (nodesStatsRaw?.nodes) {
    let totalQueryTotal = 0
    let maxUptimeMs = 0

    for (const node of Object.values(nodesStatsRaw.nodes)) {
      const qt = node.indices?.search?.query_total ?? 0
      const uptime = node.jvm?.uptime_in_millis ?? 0
      totalQueryTotal += qt
      if (uptime > maxUptimeMs) maxUptimeMs = uptime
    }

    if (maxUptimeMs > 0) {
      avgQueryRateQPS = totalQueryTotal / (maxUptimeMs / 1000)
      nodeUptimeDays = maxUptimeMs / 86_400_000
    }
  }

  // --- Retention distribution ---
  const bucketMap = new Map<number, number>()  // days → policy count

  if (ilmPoliciesRaw) {
    for (const entry of Object.values(ilmPoliciesRaw)) {
      const minAge = entry?.policy?.phases?.delete?.min_age
      if (!minAge) continue
      const days = parseMinAgeDays(minAge)
      if (days === null) continue
      const roundedDays = Math.round(days)
      bucketMap.set(roundedDays, (bucketMap.get(roundedDays) ?? 0) + 1)
    }
  }

  const retentionDistribution: RetentionBucket[] = Array.from(bucketMap.entries())
    .map(([days, policyCount]) => ({ days, policyCount }))
    .sort((a, b) => a.days - b.days)

  let primaryRetentionDays: number | null = null
  if (retentionDistribution.length > 0) {
    const modal = retentionDistribution.reduce((best, b) => b.policyCount > best.policyCount ? b : best)
    primaryRetentionDays = modal.days
  }

  // --- Ingest rate (retention-based) ---
  let ingestRateGBPerDay: number | null = null

  if (retentionDistribution.length > 0 && indices.length > 0) {
    // Primary store: divide each index total store by (1 + replicaShards)
    let primaryStoreBytes = 0
    for (const index of indices) {
      const divisor = 1 + (index.replicaShards > 0 ? index.replicaShards : 0)
      primaryStoreBytes += index.storeSizeBytes / divisor
    }

    // Weighted average retention across all bucketed policies
    const totalPolicies = retentionDistribution.reduce((s, b) => s + b.policyCount, 0)
    const weightedDays = retentionDistribution.reduce((s, b) => s + b.days * b.policyCount, 0)
    const avgRetentionDays = totalPolicies > 0 ? weightedDays / totalPolicies : 0

    if (primaryStoreBytes > 0 && avgRetentionDays > 0) {
      ingestRateGBPerDay = primaryStoreBytes / (avgRetentionDays * 1_073_741_824)
    }
  }

  return {
    avgQueryRateQPS,
    nodeUptimeDays,
    ingestRateGBPerDay,
    retentionDistribution,
    primaryRetentionDays,
  }
}
