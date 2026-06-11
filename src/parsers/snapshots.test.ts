import { describe, it, expect } from 'vitest'
import { parseSnapshots } from './snapshots'

const REPO_JSON = JSON.stringify({
  PROD_backup: { type: 's3', settings: { bucket: 'my-bucket' } },
})

const SLM_JSON = JSON.stringify({
  'daily-snapshots': {
    policy: {
      name: '<daily-snap-{now/d}>',
      schedule: '0 0 3 * * ?',
      repository: 'PROD_backup',
      retention: { expire_after: '15d', min_count: 1, max_count: 5 },
    },
    last_success: { start_time_string: '2026-06-01T03:00:00.000Z' },
    last_failure: { time_string: '2026-05-15T03:00:00.000Z' },
    stats: { snapshots_taken: 100, snapshots_failed: 2, snapshots_deleted: 80 },
  },
  'critical-info': {
    policy: {
      name: '<critical-{now/m}>',
      schedule: '0 0 */4 * * ?',
      repository: 'PROD_backup',
    },
    stats: { snapshots_taken: 50, snapshots_failed: 0, snapshots_deleted: 40 },
  },
})

describe('parseSnapshots — slmPolicies', () => {
  it('parses SLM policies into slmPolicies array', () => {
    const files = new Map([
      ['repositories.json', REPO_JSON],
      ['commercial/slm_policies.json', SLM_JSON],
    ])
    const result = parseSnapshots(files)
    expect(result).not.toBeNull()
    expect(result!.slmPolicies).toHaveLength(2)
  })

  it('extracts all fields from a fully-specified policy', () => {
    const files = new Map([
      ['repositories.json', REPO_JSON],
      ['commercial/slm_policies.json', SLM_JSON],
    ])
    const result = parseSnapshots(files)!
    const daily = result.slmPolicies.find(p => p.name === 'daily-snapshots')!
    expect(daily.repository).toBe('PROD_backup')
    expect(daily.schedule).toBe('0 0 3 * * ?')
    expect(daily.retentionExpireAfter).toBe('15d')
    expect(daily.retentionMaxCount).toBe(5)
    expect(daily.retentionMinCount).toBe(1)
    expect(daily.lastSuccessDate).toBe('2026-06-01T03:00:00.000Z')
    expect(daily.lastFailureDate).toBe('2026-05-15T03:00:00.000Z')
    expect(daily.snapshotsTaken).toBe(100)
    expect(daily.snapshotsFailed).toBe(2)
  })

  it('returns null fields gracefully when optional data is absent', () => {
    const files = new Map([
      ['repositories.json', REPO_JSON],
      ['commercial/slm_policies.json', SLM_JSON],
    ])
    const result = parseSnapshots(files)!
    const critical = result.slmPolicies.find(p => p.name === 'critical-info')!
    expect(critical.retentionExpireAfter).toBeNull()
    expect(critical.retentionMaxCount).toBeNull()
    expect(critical.retentionMinCount).toBeNull()
    expect(critical.lastSuccessDate).toBeNull()
    expect(critical.lastFailureDate).toBeNull()
  })

  it('returns empty slmPolicies when SLM file is absent', () => {
    const files = new Map([['repositories.json', REPO_JSON]])
    const result = parseSnapshots(files)!
    expect(result.slmPolicies).toEqual([])
    expect(result.slmPolicyCount).toBe(0)
    expect(result.hasSLM).toBe(false)
  })
})
