import { describe, it, expect } from 'vitest'
import { parseNodes, normalizeRole, determineTier } from './nodes'

// ── normalizeRole ─────────────────────────────────────────────────────────────

describe('normalizeRole', () => {
  it('maps legacy "data" role to "data_hot"', () => {
    expect(normalizeRole('data')).toBe('data_hot')
  })

  it('passes through known roles unchanged', () => {
    expect(normalizeRole('master')).toBe('master')
    expect(normalizeRole('data_hot')).toBe('data_hot')
    expect(normalizeRole('data_warm')).toBe('data_warm')
    expect(normalizeRole('data_cold')).toBe('data_cold')
    expect(normalizeRole('data_frozen')).toBe('data_frozen')
    expect(normalizeRole('ingest')).toBe('ingest')
    expect(normalizeRole('ml')).toBe('ml')
  })

  it('returns null for unknown roles', () => {
    expect(normalizeRole('voting_only')).toBeNull()
    expect(normalizeRole('unknown_role')).toBeNull()
    expect(normalizeRole('')).toBeNull()
  })
})

// ── determineTier ─────────────────────────────────────────────────────────────

describe('determineTier', () => {
  it('data_hot role → hot tier', () => {
    expect(determineTier(['data_hot'])).toBe('hot')
  })

  it('legacy data role (mapped to data_hot) → hot tier', () => {
    // normalizeRole maps 'data' → 'data_hot', so by the time determineTier is called
    // the roles array contains 'data_hot'
    expect(determineTier(['data_hot'])).toBe('hot')
  })

  it('data_warm role → warm tier', () => {
    expect(determineTier(['data_warm'])).toBe('warm')
  })

  it('data_cold role → cold tier', () => {
    expect(determineTier(['data_cold'])).toBe('cold')
  })

  it('data_frozen role → frozen tier', () => {
    expect(determineTier(['data_frozen'])).toBe('frozen')
  })

  it('master + data_warm → warm (data tier takes precedence over master)', () => {
    expect(determineTier(['master', 'data_warm'])).toBe('warm')
  })

  it('master + data_hot → hot (data tier takes precedence over master)', () => {
    expect(determineTier(['master', 'data_hot'])).toBe('hot')
  })

  it('master only (no data roles) → master tier', () => {
    expect(determineTier(['master'])).toBe('master')
  })

  it('master + ingest (no data roles) → master tier', () => {
    expect(determineTier(['master', 'ingest'])).toBe('master')
  })

  it('multiple data tiers → mixed', () => {
    expect(determineTier(['data_hot', 'data_warm'])).toBe('mixed')
    expect(determineTier(['data_warm', 'data_cold'])).toBe('mixed')
    expect(determineTier(['data_hot', 'data_cold', 'data_frozen'])).toBe('mixed')
  })

  it('no data or master roles → coordinating', () => {
    expect(determineTier(['ingest'])).toBe('coordinating')
    expect(determineTier(['ml'])).toBe('coordinating')
    expect(determineTier([])).toBe('coordinating')
  })
})

// ── parseNodes ────────────────────────────────────────────────────────────────

function makeNodesJson(nodes: Record<string, object>): string {
  return JSON.stringify({ nodes })
}

function makeNodesStatsJson(nodes: Record<string, object>): string {
  return JSON.stringify({ nodes })
}

function makeCatNodes(header: string, rows: string[]): string {
  return [header, ...rows].join('\n')
}

function makeCatNodeAttrs(rows: string[]): string {
  const header = 'node id pid host ip port attr value'
  return [header, ...rows].join('\n')
}

describe('parseNodes — basic parsing', () => {
  it('returns empty array when nodes.json is absent', () => {
    const files = new Map<string, string>()
    expect(parseNodes(files)).toEqual([])
  })

  it('returns empty array when nodes.json has no nodes', () => {
    const files = new Map([['nodes.json', JSON.stringify({})]])
    expect(parseNodes(files)).toEqual([])
  })

  it('parses a single node with data_hot role → hot tier', () => {
    const files = new Map([
      ['nodes.json', makeNodesJson({
        node1: { name: 'node-1', ip: '10.0.0.1', roles: ['data_hot', 'ingest'] },
      })],
    ])
    const result = parseNodes(files)
    expect(result).toHaveLength(1)
    expect(result[0].tier).toBe('hot')
    expect(result[0].name).toBe('node-1')
    expect(result[0].ip).toBe('10.0.0.1')
  })

  it('treats legacy "data" role as hot tier', () => {
    const files = new Map([
      ['nodes.json', makeNodesJson({
        node1: { name: 'node-1', ip: '10.0.0.1', roles: ['data'] },
      })],
    ])
    const result = parseNodes(files)
    expect(result[0].tier).toBe('hot')
    expect(result[0].roles).toContain('data_hot')
  })

  it('master + data_warm → warm (data tier takes precedence)', () => {
    const files = new Map([
      ['nodes.json', makeNodesJson({
        node1: { name: 'node-1', ip: '10.0.0.1', roles: ['master', 'data_warm'] },
      })],
    ])
    const result = parseNodes(files)
    expect(result[0].tier).toBe('warm')
  })
})

describe('parseNodes — resource stats fallback', () => {
  it('uses nodes_stats.json for heap and CPU when present', () => {
    const files = new Map([
      ['nodes.json', makeNodesJson({
        node1: { name: 'node-1', ip: '10.0.0.1', roles: ['master'] },
      })],
      ['nodes_stats.json', makeNodesStatsJson({
        node1: {
          name: 'node-1',
          jvm: { mem: { heap_used_percent: 55, heap_max_in_bytes: 4294967296 } },
          os: { cpu: { percent: 30 } },
          fs: { total: { total_in_bytes: 1000000000, free_in_bytes: 500000000 } },
        },
      })],
    ])
    const result = parseNodes(files)
    expect(result[0].heapPercent).toBe(55)
    expect(result[0].heapMaxBytes).toBe(4294967296)
    expect(result[0].cpuPercent).toBe(30)
    expect(result[0].diskTotal).toBe(1000000000)
  })

  it('falls back to cat_nodes.txt for heap/CPU when nodes_stats absent', () => {
    const catContent = makeCatNodes(
      'n id ip v role m d dup hp cpu',
      ['node-1 abc 10.0.0.1 8.0.0 d - 100gb 50 72 25']
    )
    const files = new Map([
      ['nodes.json', makeNodesJson({
        node1: { name: 'node-1', ip: '10.0.0.1', roles: ['data_hot'] },
      })],
      ['cat/cat_nodes.txt', catContent],
    ])
    const result = parseNodes(files)
    expect(result[0].heapPercent).toBe(72)
    expect(result[0].cpuPercent).toBe(25)
  })

  it('returns empty stats when both nodes_stats.json and cat_nodes.txt are absent', () => {
    const files = new Map([
      ['nodes.json', makeNodesJson({
        node1: { name: 'node-1', ip: '10.0.0.1', roles: ['master'] },
      })],
    ])
    const result = parseNodes(files)
    expect(result[0].heapPercent).toBeUndefined()
    expect(result[0].cpuPercent).toBeUndefined()
    expect(result[0].diskTotal).toBeUndefined()
  })

  it('node present in nodes.json but absent from nodes_stats.json does not crash', () => {
    const files = new Map([
      ['nodes.json', makeNodesJson({
        node1: { name: 'node-1', ip: '10.0.0.1', roles: ['master'] },
        node2: { name: 'node-2', ip: '10.0.0.2', roles: ['data_hot'] },
      })],
      ['nodes_stats.json', makeNodesStatsJson({
        node1: {
          jvm: { mem: { heap_used_percent: 40 } },
        },
        // node2 intentionally absent from stats
      })],
    ])
    expect(() => parseNodes(files)).not.toThrow()
    const result = parseNodes(files)
    expect(result).toHaveLength(2)
    const node2 = result.find(n => n.name === 'node-2')
    expect(node2?.heapPercent).toBeUndefined()
  })
})

describe('parseNodes — AZ from cat_nodeattrs', () => {
  it('populates zone from az attribute in cat_nodeattrs.txt', () => {
    // Format: parts[0]=node, parts[3]=attr, parts[4]=value
    const attrsContent = makeCatNodeAttrs([
      'node-1 placeholder1 placeholder2 availability_zone us-east-1a',
    ])
    const files = new Map([
      ['nodes.json', makeNodesJson({
        node1: { name: 'node-1', ip: '10.0.0.1', roles: ['data_hot'] },
      })],
      ['cat/cat_nodeattrs.txt', attrsContent],
    ])
    const result = parseNodes(files)
    expect(result[0].az).toBe('us-east-1a')
  })

  it('returns undefined az when cat_nodeattrs.txt is absent', () => {
    const files = new Map([
      ['nodes.json', makeNodesJson({
        node1: { name: 'node-1', ip: '10.0.0.1', roles: ['master'] },
      })],
    ])
    const result = parseNodes(files)
    expect(result[0].az).toBeUndefined()
  })
})
