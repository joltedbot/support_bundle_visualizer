import { describe, it, expect } from 'vitest'
import {
  groupNodesByAZ,
  buildSummaryBar,
  computePlacements,
  sortNodesByPlacement,
  buildTopologyColumns,
  UNKNOWN_AZ_LABEL,
} from './nodeRoles'
import type { NodeInfo } from '../parsers/types'

// Helper to build a minimal NodeInfo
function node(overrides: Partial<NodeInfo> & { id: string; roles: NodeInfo['roles']; tier: NodeInfo['tier'] }): NodeInfo {
  return { name: overrides.id, ip: '1.2.3.4', ...overrides }
}

describe('groupNodesByAZ', () => {
  it('returns null when no node has az populated', () => {
    const nodes = [node({ id: 'a', roles: ['data_hot'], tier: 'hot' })]
    expect(groupNodesByAZ(nodes)).toBeNull()
  })

  it('groups nodes by az when at least one has az', () => {
    const n1 = node({ id: 'a', roles: ['data_hot'], tier: 'hot', az: 'us-east-1a' })
    const n2 = node({ id: 'b', roles: ['data_hot'], tier: 'hot', az: 'us-east-1b' })
    const result = groupNodesByAZ([n1, n2])!
    expect(result.get('us-east-1a')).toHaveLength(1)
    expect(result.get('us-east-1b')).toHaveLength(1)
  })

  it('puts nodes without az into "Unknown AZ" bucket', () => {
    const n1 = node({ id: 'a', roles: ['data_hot'], tier: 'hot', az: 'us-east-1a' })
    const n2 = node({ id: 'b', roles: ['data_hot'], tier: 'hot' })
    const result = groupNodesByAZ([n1, n2])!
    expect(result.get(UNKNOWN_AZ_LABEL)).toHaveLength(1)
  })

  it('az groups are sorted alphabetically with Unknown AZ last', () => {
    const n1 = node({ id: 'a', roles: ['data_hot'], tier: 'hot', az: 'us-east-1c' })
    const n2 = node({ id: 'b', roles: ['data_hot'], tier: 'hot', az: 'us-east-1a' })
    const n3 = node({ id: 'c', roles: ['data_hot'], tier: 'hot' })
    const keys = Array.from(groupNodesByAZ([n1, n2, n3])!.keys())
    expect(keys).toEqual(['us-east-1a', 'us-east-1c', UNKNOWN_AZ_LABEL])
  })
})

describe('buildSummaryBar', () => {
  it('counts data tier nodes by data tier only', () => {
    const nodes = [
      node({ id: 'a', roles: ['data_hot'], tier: 'hot' }),
      node({ id: 'b', roles: ['data_hot'], tier: 'hot' }),
      node({ id: 'c', roles: ['data_warm'], tier: 'warm' }),
    ]
    const bar = buildSummaryBar(nodes)
    expect(bar.find(e => e.tier === 'hot')?.count).toBe(2)
    expect(bar.find(e => e.tier === 'warm')?.count).toBe(1)
    expect(bar.find(e => e.tier === 'master')).toBeUndefined()
  })

  it('omits zero-count tiers', () => {
    const nodes = [node({ id: 'a', roles: ['data_hot'], tier: 'hot' })]
    const bar = buildSummaryBar(nodes)
    expect(bar.every(e => e.count > 0 || e.shared)).toBe(true)
  })

  it('shows Master: Shared when master role exists only on data nodes', () => {
    const nodes = [
      node({ id: 'a', roles: ['master', 'data_hot'], tier: 'hot' }),
      node({ id: 'b', roles: ['master', 'data_hot'], tier: 'hot' }),
    ]
    const bar = buildSummaryBar(nodes)
    const masterEntry = bar.find(e => e.tier === 'master')
    expect(masterEntry?.shared).toBe(true)
  })

  it('shows master count when dedicated master nodes exist', () => {
    const nodes = [
      node({ id: 'a', roles: ['master'], tier: 'master' }),
      node({ id: 'b', roles: ['data_hot'], tier: 'hot' }),
    ]
    const bar = buildSummaryBar(nodes)
    const masterEntry = bar.find(e => e.tier === 'master')
    expect(masterEntry?.count).toBe(1)
    expect(masterEntry?.shared).toBeFalsy()
  })

  it('omits master entirely when no node has master role', () => {
    const nodes = [node({ id: 'a', roles: ['data_hot'], tier: 'hot' })]
    const bar = buildSummaryBar(nodes)
    expect(bar.find(e => e.tier === 'master')).toBeUndefined()
  })

  it('counts remote_cluster_client under coordinating', () => {
    const nodes = [node({ id: 'a', roles: ['remote_cluster_client'], tier: 'coordinating' })]
    const bar = buildSummaryBar(nodes)
    expect(bar.find(e => e.tier === 'coordinating')?.count).toBe(1)
  })
})

describe('computePlacements', () => {
  const place = (nodes: NodeInfo[], id: string) => computePlacements(nodes).get(id)

  it('hot + master is Hot', () => {
    const n = node({ id: 'a', roles: ['master', 'data_hot'], tier: 'hot' })
    expect(place([n], 'a')).toBe('hot')
  })
  it('hot + ml is Hot', () => {
    const n = node({ id: 'a', roles: ['data_hot', 'ml'], tier: 'hot' })
    expect(place([n], 'a')).toBe('hot')
  })
  it('hot + ingest + coordinating is Hot', () => {
    const n = node({ id: 'a', roles: ['data_hot', 'ingest', 'coordinating'], tier: 'hot' })
    expect(place([n], 'a')).toBe('hot')
  })
  it('master + warm is Master (highest non-hot role)', () => {
    const n = node({ id: 'a', roles: ['master', 'data_warm'], tier: 'warm' })
    expect(place([n], 'a')).toBe('master')
  })
  it('ingest + ml is Ingest, ml + remote_cluster_client is ML', () => {
    const a = node({ id: 'a', roles: ['ingest', 'ml'], tier: 'coordinating' })
    const b = node({ id: 'b', roles: ['ml', 'remote_cluster_client'], tier: 'coordinating' })
    expect(place([a, b], 'a')).toBe('ingest')
    expect(place([a, b], 'b')).toBe('ml')
  })
  it('warm, cold and frozen map to their own sections', () => {
    const nodes = [
      node({ id: 'w', roles: ['data_warm'], tier: 'warm' }),
      node({ id: 'c', roles: ['data_cold'], tier: 'cold' }),
      node({ id: 'f', roles: ['data_frozen'], tier: 'frozen' }),
    ]
    expect(['w', 'c', 'f'].map(id => place(nodes, id))).toEqual(['warm', 'cold', 'frozen'])
  })
  it('a role-less node is placed with Ingest/Coordinating', () => {
    expect(place([node({ id: 'a', roles: [], tier: 'coordinating' })], 'a')).toBe('ingest')
  })
  it('tiebreaker joins Hot when the other master-eligible nodes are Hot', () => {
    const nodes = [
      node({ id: 'h1', roles: ['master', 'data_hot'], tier: 'hot' }),
      node({ id: 'h2', roles: ['master', 'data_hot'], tier: 'hot' }),
      node({ id: 't', roles: ['master'], tier: 'master' }),
    ]
    expect(place(nodes, 't')).toBe('hot')
  })
  it('dedicated masters stay in Master when hot nodes are not master-eligible', () => {
    const nodes = [
      node({ id: 'h1', roles: ['data_hot'], tier: 'hot' }),
      node({ id: 'm1', roles: ['master'], tier: 'master' }),
    ]
    expect(place(nodes, 'm1')).toBe('master')
  })
  it('a single hot/master node with one dedicated master does not trigger the exception', () => {
    const nodes = [
      node({ id: 'h1', roles: ['master', 'data_hot'], tier: 'hot' }),
      node({ id: 'm1', roles: ['master'], tier: 'master' }),
    ]
    expect(place(nodes, 'm1')).toBe('master')
  })
  it('a master+ml node is not treated as a tiebreaker', () => {
    const nodes = [
      node({ id: 'h1', roles: ['master', 'data_hot'], tier: 'hot' }),
      node({ id: 'h2', roles: ['master', 'data_hot'], tier: 'hot' }),
      node({ id: 'm1', roles: ['master', 'ml'], tier: 'master' }),
    ]
    expect(place(nodes, 'm1')).toBe('master')
  })
  it('three dedicated masters stay in Master even if a hot node is master-eligible', () => {
    const nodes = [
      node({ id: 'h1', roles: ['master', 'data_hot'], tier: 'hot' }),
      node({ id: 'm1', roles: ['master'], tier: 'master' }),
      node({ id: 'm2', roles: ['master'], tier: 'master' }),
      node({ id: 'm3', roles: ['master'], tier: 'master' }),
    ]
    expect(place(nodes, 'm1')).toBe('master')
  })
})

describe('sortNodesByPlacement', () => {
  it('orders Master, Ingest, Hot, Warm, Cold, Frozen, ML, then by numeric name', () => {
    const nodes = [
      node({ id: 'ml', roles: ['ml'], tier: 'coordinating', name: 'ml' }),
      node({ id: 'h10', roles: ['data_hot'], tier: 'hot', name: 'instance-10' }),
      node({ id: 'h2', roles: ['data_hot'], tier: 'hot', name: 'instance-2' }),
      node({ id: 'fz', roles: ['data_frozen'], tier: 'frozen', name: 'fz' }),
      node({ id: 'm', roles: ['master'], tier: 'master', name: 'm' }),
      node({ id: 'i', roles: ['ingest'], tier: 'coordinating', name: 'i' }),
    ]
    const sorted = sortNodesByPlacement(nodes, computePlacements(nodes)).map(n => n.id)
    expect(sorted).toEqual(['m', 'i', 'h2', 'h10', 'fz', 'ml'])
  })
})

describe('buildTopologyColumns', () => {
  it('returns one Self Hosted column when no node has an AZ', () => {
    const nodes = [node({ id: 'a', roles: ['data_hot'], tier: 'hot' })]
    const cols = buildTopologyColumns(nodes)
    expect(cols.map(c => c.label)).toEqual(['Self Hosted'])
    expect(cols[0].nodes).toHaveLength(1)
  })
  it('returns one column per AZ in name order, Unknown AZ last', () => {
    const nodes = [
      node({ id: 'a', roles: ['data_hot'], tier: 'hot', az: 'us-east-1b' }),
      node({ id: 'b', roles: ['data_hot'], tier: 'hot', az: 'us-east-1a' }),
      node({ id: 'c', roles: ['data_hot'], tier: 'hot' }),
    ]
    expect(buildTopologyColumns(nodes).map(c => c.label)).toEqual(['us-east-1a', 'us-east-1b', UNKNOWN_AZ_LABEL])
  })
  it('returns no columns for no nodes', () => {
    expect(buildTopologyColumns([])).toEqual([])
  })
})
