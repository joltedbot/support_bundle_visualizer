import { parseJsonFile } from '../utils/bundleReader'
import type { SnapshotInfo, SnapshotRepository, SLMPolicyDetail } from './types'

const REPO_SETTINGS_ALLOWLIST = ['bucket', 'container', 'base_path', 'location', 'compress'] as const

interface RepositoryJson {
  type?: string
  settings?: Record<string, unknown>
}

interface SnapshotJson {
  snapshots?: Array<{
    snapshot?: string
    repository?: string
    state?: string
    end_time_in_millis?: number | null
  }>
}

interface SLMPolicyJson {
  policy?: {
    repository?: string
    schedule?: string
    retention?: {
      expire_after?: string
      min_count?: number
      max_count?: number
    }
  }
  last_success?: { start_time_string?: string }
  last_failure?: { time_string?: string }
  stats?: { snapshots_taken?: number; snapshots_failed?: number }
  next_execution_millis?: number | null
}

export function parseSnapshots(files: Map<string, string>, collectionDateMs: number | null = null): SnapshotInfo | null {
  const repositoriesRaw = parseJsonFile<Record<string, RepositoryJson>>(files, 'repositories.json')
  const snapshotsRaw = parseJsonFile<SnapshotJson>(files, 'snapshot.json')
  const slmRaw = parseJsonFile<Record<string, SLMPolicyJson>>(files, 'commercial/slm_policies.json')
  const ilmStatusRaw = parseJsonFile<{ operation_mode?: string }>(files, 'commercial/ilm_status.json')
  const slmStatusRaw = parseJsonFile<{ operation_mode?: string }>(files, 'commercial/slm_status.json')

  if (!repositoriesRaw && !slmRaw) return null

  const repositoryNames = repositoriesRaw ? Object.keys(repositoriesRaw) : []
  const repositoryCount = repositoryNames.length

  const slmPolicies: SLMPolicyDetail[] = []
  if (slmRaw) {
    for (const [name, entry] of Object.entries(slmRaw)) {
      const nextExecutionMillis = entry?.next_execution_millis ?? null
      const overdue =
        nextExecutionMillis !== null &&
        collectionDateMs !== null &&
        nextExecutionMillis < collectionDateMs
      slmPolicies.push({
        name,
        repository: entry?.policy?.repository ?? '',
        schedule: entry?.policy?.schedule ?? '',
        retentionExpireAfter: entry?.policy?.retention?.expire_after ?? null,
        retentionMaxCount: entry?.policy?.retention?.max_count ?? null,
        retentionMinCount: entry?.policy?.retention?.min_count ?? null,
        lastSuccessDate: entry?.last_success?.start_time_string ?? null,
        lastFailureDate: entry?.last_failure?.time_string ?? null,
        snapshotsTaken: entry?.stats?.snapshots_taken ?? 0,
        snapshotsFailed: entry?.stats?.snapshots_failed ?? 0,
        nextExecutionMillis,
        overdue,
      })
    }
  }

  const slmPolicyCount = slmPolicies.length
  const hasSLM = slmPolicyCount > 0

  const repositories: SnapshotRepository[] = []
  if (repositoriesRaw) {
    for (const [name, repo] of Object.entries(repositoriesRaw)) {
      const repoSnapshots = (Array.isArray(snapshotsRaw?.snapshots) ? snapshotsRaw.snapshots : []).filter(s => s?.repository === name)

      // Allowlist: only keys the UI renders are baked into the customer-delivered HTML.
      // Repository settings can also carry endpoints, roles and proxies that should not ship.
      const settings: Record<string, string> = {}
      if (repo?.settings && typeof repo.settings === 'object') {
        for (const k of REPO_SETTINGS_ALLOWLIST) {
          const v = repo.settings[k]
          if (v !== undefined && v !== null) settings[k] = String(v)
        }
      }

      // Find the latest successful snapshot end time for age calculation
      const successEndTimes = repoSnapshots.flatMap(s =>
        s?.state === 'SUCCESS' && typeof s.end_time_in_millis === 'number' ? [s.end_time_in_millis] : []
      )
      const latestSuccessMs = successEndTimes.length > 0
        ? successEndTimes.reduce((acc, t) => Math.max(acc, t), -Infinity)
        : null
      const rawAgeMs =
        latestSuccessMs !== null && collectionDateMs !== null
          ? collectionDateMs - latestSuccessMs
          : null
      const lastSuccessfulSnapshotAgeMs = rawAgeMs !== null && rawAgeMs >= 0 ? rawAgeMs : null

      repositories.push({
        name,
        type: repo?.type || 'unknown',
        snapshotCount: repoSnapshots.length,
        successCount: repoSnapshots.filter(s => s.state === 'SUCCESS').length,
        failedCount: repoSnapshots.filter(s => s.state === 'FAILED' || s.state === 'PARTIAL').length,
        settings,
        lastSuccessfulSnapshotAgeMs,
      })
    }
  }

  return {
    repositoryCount,
    repositoryNames,
    repositories,
    hasSLM,
    slmPolicyCount,
    slmPolicies,
    ilmOperationMode: ilmStatusRaw?.operation_mode ?? null,
    slmOperationMode: slmStatusRaw?.operation_mode ?? null,
  }
}
