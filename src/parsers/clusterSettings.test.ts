import { describe, it, expect } from 'vitest'
import { parseClusterSettings } from './clusterSettings'

const files = (obj: unknown) => new Map([['cluster_settings.json', JSON.stringify(obj)]])

describe('parseClusterSettings', () => {
  it('returns null when the file is missing', () => {
    expect(parseClusterSettings(new Map())).toBeNull()
  })

  it('reads a flat key', () => {
    const r = parseClusterSettings(files({ persistent: { 'cluster.max_shards_per_node': '2000' } }))
    expect(r?.maxShardsPerNode).toBe(2000)
  })

  it('reads a nested path and the frozen limit', () => {
    const r = parseClusterSettings(files({
      persistent: { cluster: { max_shards_per_node: { frozen: '5000' } } },
    }))
    expect(r?.maxShardsPerNodeFrozen).toBe(5000)
  })

  it('lets transient win over persistent', () => {
    const r = parseClusterSettings(files({
      persistent: { 'cluster.max_shards_per_node': '1000' },
      transient: { 'cluster.max_shards_per_node': '3000' },
    }))
    expect(r?.maxShardsPerNode).toBe(3000)
  })

  it('ignores inherited / prototype keys and non-object nodes', () => {
    const raw = '{"persistent":{"__proto__":{"cluster":{"max_shards_per_node":"9"}},"cluster":"oops"}}'
    const r = parseClusterSettings(new Map([['cluster_settings.json', raw]]))
    expect(r?.maxShardsPerNode).toBeNull()
  })
})
