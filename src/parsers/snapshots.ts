import { parseJsonFile } from '../utils/bundleReader'
import type { SnapshotInfo, SnapshotRepository, SLMPolicyDetail } from './types'

interface RepositoryJson {
  type?: string
  settings?: Record<string, unknown>
}

interface SnapshotJson {
  snapshots?: Array<{
    snapshot?: string
    repository?: string
    state?: string
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
}

export function parseSnapshots(files: Map<string, string>): SnapshotInfo | null {
  const repositoriesRaw = parseJsonFile<Record<string, RepositoryJson>>(files, 'repositories.json')
  const snapshotsRaw = parseJsonFile<SnapshotJson>(files, 'snapshot.json')
  const slmRaw = parseJsonFile<Record<string, SLMPolicyJson>>(files, 'commercial/slm_policies.json')

  if (!repositoriesRaw && !slmRaw) return null

  const repositoryNames = repositoriesRaw ? Object.keys(repositoriesRaw) : []
  const repositoryCount = repositoryNames.length

  const slmPolicies: SLMPolicyDetail[] = []
  if (slmRaw) {
    for (const [name, entry] of Object.entries(slmRaw)) {
      slmPolicies.push({
        name,
        repository: entry.policy?.repository ?? '',
        schedule: entry.policy?.schedule ?? '',
        retentionExpireAfter: entry.policy?.retention?.expire_after ?? null,
        retentionMaxCount: entry.policy?.retention?.max_count ?? null,
        retentionMinCount: entry.policy?.retention?.min_count ?? null,
        lastSuccessDate: entry.last_success?.start_time_string ?? null,
        lastFailureDate: entry.last_failure?.time_string ?? null,
        snapshotsTaken: entry.stats?.snapshots_taken ?? 0,
        snapshotsFailed: entry.stats?.snapshots_failed ?? 0,
      })
    }
  }

  const slmPolicyCount = slmPolicies.length
  const hasSLM = slmPolicyCount > 0

  const repositories: SnapshotRepository[] = []
  if (repositoriesRaw) {
    for (const [name, repo] of Object.entries(repositoriesRaw)) {
      const repoSnapshots = (snapshotsRaw?.snapshots ?? []).filter(s => s.repository === name)

      const settings: Record<string, string> = {}
      if (repo.settings) {
        for (const [k, v] of Object.entries(repo.settings)) {
          settings[k] = String(v)
        }
      }

      repositories.push({
        name,
        type: repo.type || 'unknown',
        snapshotCount: repoSnapshots.length,
        successCount: repoSnapshots.filter(s => s.state === 'SUCCESS').length,
        failedCount: repoSnapshots.filter(s => s.state === 'FAILED' || s.state === 'PARTIAL').length,
        settings,
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
  }
}
