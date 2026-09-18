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

const COLLECTION_DATE_MS = new Date('2026-07-01T00:00:00.000Z').getTime()

describe('parseSnapshots — lastSuccessfulSnapshotAgeMs', () => {
  it('computes age from the most recent successful snapshot end_time_in_millis', () => {
    const snapshotMs = new Date('2026-06-29T12:00:00.000Z').getTime()
    const files = new Map([
      ['repositories.json', JSON.stringify({ myrepo: { type: 's3', settings: {} } })],
      ['snapshot.json', JSON.stringify({
        snapshots: [
          { snapshot: 'snap-1', repository: 'myrepo', state: 'SUCCESS', end_time_in_millis: snapshotMs },
          { snapshot: 'snap-2', repository: 'myrepo', state: 'FAILED', end_time_in_millis: COLLECTION_DATE_MS - 1000 },
        ],
      })],
    ])
    const result = parseSnapshots(files, COLLECTION_DATE_MS)!
    expect(result.repositories[0].lastSuccessfulSnapshotAgeMs).toBe(COLLECTION_DATE_MS - snapshotMs)
  })

  it('returns null when no successful snapshots exist for a repo', () => {
    const files = new Map([
      ['repositories.json', JSON.stringify({ myrepo: { type: 's3', settings: {} } })],
      ['snapshot.json', JSON.stringify({
        snapshots: [
          { snapshot: 'snap-1', repository: 'myrepo', state: 'FAILED', end_time_in_millis: 1000 },
        ],
      })],
    ])
    const result = parseSnapshots(files, COLLECTION_DATE_MS)!
    expect(result.repositories[0].lastSuccessfulSnapshotAgeMs).toBeNull()
  })

  it('returns null when collectionDateMs is not provided', () => {
    const snapshotMs = new Date('2026-06-29T12:00:00.000Z').getTime()
    const files = new Map([
      ['repositories.json', JSON.stringify({ myrepo: { type: 's3', settings: {} } })],
      ['snapshot.json', JSON.stringify({
        snapshots: [{ snapshot: 'snap-1', repository: 'myrepo', state: 'SUCCESS', end_time_in_millis: snapshotMs }],
      })],
    ])
    const result = parseSnapshots(files)!
    expect(result.repositories[0].lastSuccessfulSnapshotAgeMs).toBeNull()
  })

  it('marks an SLM policy as overdue when next_execution_millis is in the past', () => {
    const overdueMs = COLLECTION_DATE_MS - 3600_000  // 1 hour ago
    const files = new Map([
      ['repositories.json', JSON.stringify({ myrepo: { type: 's3', settings: {} } })],
      ['commercial/slm_policies.json', JSON.stringify({
        'my-policy': {
          policy: { repository: 'myrepo', schedule: '0 0 * * * ?' },
          stats: { snapshots_taken: 10, snapshots_failed: 0 },
          next_execution_millis: overdueMs,
        },
      })],
    ])
    const result = parseSnapshots(files, COLLECTION_DATE_MS)!
    expect(result.slmPolicies[0].overdue).toBe(true)
    expect(result.slmPolicies[0].nextExecutionMillis).toBe(overdueMs)
  })
})

describe('parseSnapshots — ILM/SLM operation mode', () => {
  it('parses ilmOperationMode from commercial/ilm_status.json', () => {
    const files = new Map([
      ['repositories.json', REPO_JSON],
      ['commercial/ilm_status.json', JSON.stringify({ operation_mode: 'STOPPED' })],
    ])
    const result = parseSnapshots(files)!
    expect(result.ilmOperationMode).toBe('STOPPED')
  })

  it('returns null for ilmOperationMode when file is absent', () => {
    const files = new Map([['repositories.json', REPO_JSON]])
    const result = parseSnapshots(files)!
    expect(result.ilmOperationMode).toBeNull()
    expect(result.slmOperationMode).toBeNull()
  })
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
