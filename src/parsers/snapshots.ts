import { parseJsonFile } from '../utils/bundleReader'
import type { SnapshotInfo, SnapshotRepository } from './types'

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

/**
 * Parse repositories.json + snapshot.json + commercial/slm_policies.json → SnapshotInfo.
 * Returns null if both files are missing.
 */
export function parseSnapshots(files: Map<string, string>): SnapshotInfo | null {
  const repositoriesRaw = parseJsonFile<Record<string, RepositoryJson>>(files, 'repositories.json')
  const snapshotsRaw = parseJsonFile<SnapshotJson>(files, 'snapshot.json')
  const slmPolicies = parseJsonFile<Record<string, unknown>>(files, 'commercial/slm_policies.json')

  if (!repositoriesRaw && !slmPolicies) return null

  const repositoryNames = repositoriesRaw ? Object.keys(repositoriesRaw) : []
  const repositoryCount = repositoryNames.length

  const slmPolicyCount = slmPolicies ? Object.keys(slmPolicies).length : 0
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
        settings
      })
    }
  }

  return {
    repositoryCount,
    repositoryNames,
    repositories,
    hasSLM,
    slmPolicyCount,
  }
}
