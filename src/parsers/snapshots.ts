import { parseJsonFile } from '../utils/bundleReader'
import type { SnapshotInfo } from './types'

/**
 * Parse repositories.json + commercial/slm_policies.json → SnapshotInfo.
 * Returns null if both files are missing.
 */
export function parseSnapshots(files: Map<string, string>): SnapshotInfo | null {
  const repositories = parseJsonFile<Record<string, unknown>>(files, 'repositories.json')
  const slmPolicies = parseJsonFile<Record<string, unknown>>(files, 'commercial/slm_policies.json')

  if (!repositories && !slmPolicies) return null

  const repositoryNames = repositories ? Object.keys(repositories) : []
  const repositoryCount = repositoryNames.length

  const slmPolicyCount = slmPolicies ? Object.keys(slmPolicies).length : 0
  const hasSLM = slmPolicyCount > 0

  return {
    repositoryCount,
    repositoryNames,
    hasSLM,
    slmPolicyCount,
  }
}
