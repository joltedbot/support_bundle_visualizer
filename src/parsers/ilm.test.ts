import { describe, it, expect } from 'vitest'
import { parseILM, parseMinAgeDays, buildIndexPolicyMap } from './ilm'

// ── parseMinAgeDays ───────────────────────────────────────────────────────────

describe('parseMinAgeDays', () => {
  it('"7d" → 7', () => {
    expect(parseMinAgeDays('7d')).toBe(7)
  })

  it('"30d" → 30', () => {
    expect(parseMinAgeDays('30d')).toBe(30)
  })

  it('"24h" → 1 (24 hours = 1 day)', () => {
    expect(parseMinAgeDays('24h')).toBe(1)
  })

  it('"6M" → 180 (6 months ≈ 180 days)', () => {
    expect(parseMinAgeDays('6M')).toBe(180)
  })

  it('"1y" → 365', () => {
    expect(parseMinAgeDays('1y')).toBe(365)
  })

  it('"0ms" → null (zero is treated as no age)', () => {
    expect(parseMinAgeDays('0ms')).toBeNull()
  })

  it('"0s" → null', () => {
    expect(parseMinAgeDays('0s')).toBeNull()
  })

  it('"0" → null', () => {
    expect(parseMinAgeDays('0')).toBeNull()
  })

  it('empty string → null', () => {
    expect(parseMinAgeDays('')).toBeNull()
  })

  it('null-like (empty) → null', () => {
    expect(parseMinAgeDays('')).toBeNull()
  })

  it('unparseable string → null', () => {
    expect(parseMinAgeDays('forever')).toBeNull()
    expect(parseMinAgeDays('invalid')).toBeNull()
  })

  it('negative value → null', () => {
    expect(parseMinAgeDays('-7d')).toBeNull()
  })
})

// ── parseILM — ilm_explain shape variations ───────────────────────────────────

const POLICIES_JSON = JSON.stringify({
  'my-policy': {
    policy: {
      phases: {
        hot: {
          actions: {
            rollover: { max_age: '30d', max_primary_shard_size: '50gb' },
          },
        },
        warm: {
          min_age: '7d',
          actions: { forcemerge: { max_num_segments: 1 } },
        },
        cold: {
          min_age: '30d',
        },
        delete: {
          min_age: '90d',
        },
      },
    },
  },
})

const EXPLAIN_WITH_WRAPPER = JSON.stringify({
  indices: {
    'my-index-000001': { managed: true, policy: 'my-policy', phase: 'hot' },
    'my-index-000002': { managed: true, policy: 'my-policy', phase: 'warm' },
    'unmanaged-index': { managed: false },
  },
})

const EXPLAIN_FLAT = JSON.stringify({
  'my-index-000001': { managed: true, policy: 'my-policy', phase: 'hot' },
  'my-index-000002': { managed: true, policy: 'my-policy', phase: 'cold' },
})

describe('parseILM — wrapped ilm_explain.json shape', () => {
  it('parses correctly with .indices wrapper', () => {
    const files = new Map([
      ['commercial/ilm_policies.json', POLICIES_JSON],
      ['commercial/ilm_explain.json', EXPLAIN_WITH_WRAPPER],
    ])
    const result = parseILM(files)
    expect(result).not.toBeNull()
    expect(result!.managedIndexCount).toBe(2)
    expect(result!.tiers.hot).toBe(1)
    expect(result!.tiers.warm).toBe(1)
  })

  it('counts only managed indices (ignores managed: false)', () => {
    const files = new Map([
      ['commercial/ilm_policies.json', POLICIES_JSON],
      ['commercial/ilm_explain.json', EXPLAIN_WITH_WRAPPER],
    ])
    const result = parseILM(files)
    expect(result!.managedIndexCount).toBe(2)
  })
})

describe('parseILM — flat ilm_explain.json shape (no .indices wrapper)', () => {
  it('parses correctly without .indices wrapper', () => {
    const files = new Map([
      ['commercial/ilm_policies.json', POLICIES_JSON],
      ['commercial/ilm_explain.json', EXPLAIN_FLAT],
    ])
    const result = parseILM(files)
    expect(result).not.toBeNull()
    expect(result!.managedIndexCount).toBe(2)
    expect(result!.tiers.hot).toBe(1)
    expect(result!.tiers.cold).toBe(1)
  })
})

describe('parseILM — absent files', () => {
  it('returns null when both ilm_explain.json and ilm_policies.json are absent', () => {
    const files = new Map<string, string>()
    expect(parseILM(files)).toBeNull()
  })

  it('returns a result when only ilm_policies.json is present', () => {
    const files = new Map([
      ['commercial/ilm_policies.json', POLICIES_JSON],
    ])
    const result = parseILM(files)
    expect(result).not.toBeNull()
    expect(result!.policyCount).toBe(1)
    expect(result!.managedIndexCount).toBe(0)
  })

  it('returns a result when only ilm_explain.json is present', () => {
    const files = new Map([
      ['commercial/ilm_explain.json', EXPLAIN_WITH_WRAPPER],
    ])
    const result = parseILM(files)
    expect(result).not.toBeNull()
    expect(result!.managedIndexCount).toBe(2)
    expect(result!.policies).toHaveLength(0)
  })
})

describe('parseILM — policy detail parsing', () => {
  it('parses hot rollover age and size', () => {
    const files = new Map([
      ['commercial/ilm_policies.json', POLICIES_JSON],
      ['commercial/ilm_explain.json', EXPLAIN_WITH_WRAPPER],
    ])
    const result = parseILM(files)!
    const policy = result.policies[0]
    expect(policy.name).toBe('my-policy')
    expect(policy.hotMaxAge).toBe('30d')
    expect(policy.hotMaxSize).toBe('50gb')
  })

  it('parses warm, cold, and delete min_age', () => {
    const files = new Map([
      ['commercial/ilm_policies.json', POLICIES_JSON],
      ['commercial/ilm_explain.json', EXPLAIN_WITH_WRAPPER],
    ])
    const result = parseILM(files)!
    const policy = result.policies[0]
    expect(policy.warmMinAge).toBe('7d')
    expect(policy.coldMinAge).toBe('30d')
    expect(policy.deleteDays).toBe(90)
  })

  it('parses forcemerge segments from warm phase', () => {
    const files = new Map([
      ['commercial/ilm_policies.json', POLICIES_JSON],
      ['commercial/ilm_explain.json', EXPLAIN_WITH_WRAPPER],
    ])
    const result = parseILM(files)!
    expect(result.policies[0].forceMergeSegments).toBe(1)
  })

  it('counts managed indices per policy', () => {
    const files = new Map([
      ['commercial/ilm_policies.json', POLICIES_JSON],
      ['commercial/ilm_explain.json', EXPLAIN_WITH_WRAPPER],
    ])
    const result = parseILM(files)!
    expect(result.policies[0].indexCount).toBe(2)
  })
})

// ── buildIndexPolicyMap ───────────────────────────────────────────────────────

describe('buildIndexPolicyMap', () => {
  it('builds map from wrapped shape', () => {
    const files = new Map([
      ['commercial/ilm_explain.json', EXPLAIN_WITH_WRAPPER],
    ])
    const map = buildIndexPolicyMap(files)
    expect(map.get('my-index-000001')).toBe('my-policy')
    expect(map.get('my-index-000002')).toBe('my-policy')
    expect(map.has('unmanaged-index')).toBe(false)
  })

  it('builds map from flat shape', () => {
    const files = new Map([
      ['commercial/ilm_explain.json', EXPLAIN_FLAT],
    ])
    const map = buildIndexPolicyMap(files)
    expect(map.get('my-index-000001')).toBe('my-policy')
  })

  it('returns empty map when file is absent', () => {
    const files = new Map<string, string>()
    expect(buildIndexPolicyMap(files).size).toBe(0)
  })
})
