import { describe, it, expect } from 'vitest'
import {
  getNodeSortPriority,
  groupNodesByAZ,
  buildSummaryBar,
} from './nodeRoles'
import type { NodeInfo } from '../parsers/types'

// Helper to build a minimal NodeInfo
function node(overrides: Partial<NodeInfo> & { id: string; roles: NodeInfo['roles']; tier: NodeInfo['tier'] }): NodeInfo {
  return { name: overrides.id, ip: '1.2.3.4', ...overrides }
}

describe('getNodeSortPriority', () => {
  it('master-only node sorts before ml', () => {
    const master = node({ id: 'a', roles: ['master'], tier: 'master' })
    const ml = node({ id: 'b', roles: ['ml'], tier: 'coordinating' })
    expect(getNodeSortPriority(master)).toBeLessThan(getNodeSortPriority(ml))
  })

  it('data_hot node sorts after coordinating', () => {
    const hot = node({ id: 'a', roles: ['data_hot'], tier: 'hot' })
    const coord = node({ id: 'b', roles: ['coordinating'], tier: 'coordinating' })
    expect(getNodeSortPriority(hot)).toBeGreaterThan(getNodeSortPriority(coord))
  })

  it('data tier takes priority over master role on same node', () => {
    const hotMaster = node({ id: 'a', roles: ['master', 'data_hot'], tier: 'hot' })
    const pureMaster = node({ id: 'b', roles: ['master'], tier: 'master' })
    expect(getNodeSortPriority(hotMaster)).toBeGreaterThan(getNodeSortPriority(pureMaster))
  })

  it('remote_cluster_client sorts with coordinating', () => {
    const rcc = node({ id: 'a', roles: ['remote_cluster_client'], tier: 'coordinating' })
    const coord = node({ id: 'b', roles: ['coordinating'], tier: 'coordinating' })
    expect(getNodeSortPriority(rcc)).toEqual(getNodeSortPriority(coord))
  })

  it('frozen sorts last among data tiers', () => {
    const frozen = node({ id: 'a', roles: ['data_frozen'], tier: 'frozen' })
    const hot = node({ id: 'b', roles: ['data_hot'], tier: 'hot' })
    expect(getNodeSortPriority(frozen)).toBeGreaterThan(getNodeSortPriority(hot))
  })
})

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
    expect(result.get('Unknown AZ')).toHaveLength(1)
  })

  it('az groups are sorted alphabetically with Unknown AZ last', () => {
    const n1 = node({ id: 'a', roles: ['data_hot'], tier: 'hot', az: 'us-east-1c' })
    const n2 = node({ id: 'b', roles: ['data_hot'], tier: 'hot', az: 'us-east-1a' })
    const n3 = node({ id: 'c', roles: ['data_hot'], tier: 'hot' })
    const keys = Array.from(groupNodesByAZ([n1, n2, n3])!.keys())
    expect(keys).toEqual(['us-east-1a', 'us-east-1c', 'Unknown AZ'])
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
