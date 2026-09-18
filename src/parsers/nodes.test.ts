import { describe, it, expect } from 'vitest'
import { parseNodes, buildNodeHealthSignals } from './nodes'
import type { NodeInfo } from './types'

function makeNodesJson(
  nodeId: string,
  nodeName: string,
  osOverrides: Record<string, unknown> = {}
): string {
  return JSON.stringify({
    nodes: {
      [nodeId]: { name: nodeName, ip: '10.0.0.1', roles: ['data_hot'], os: osOverrides },
    },
  })
}

function makeNodesStatsJson(
  nodeId: string,
  overrides: Record<string, unknown> = {}
): string {
  return JSON.stringify({
    nodes: {
      [nodeId]: {
        name: nodeId,
        jvm: {
          uptime_in_millis: 4648905099,
          mem: { heap_used_percent: 70, heap_max_in_bytes: 17179869184 },
        },
        os: {
          mem: {
            total_in_bytes: 34359738368,
            used_in_bytes: 32844574720,
          },
        },
        indices: {
          dense_vector: { value_count: 100, off_heap: { total_size_bytes: 524288000 } },
        },
        ...overrides,
      },
    },
  })
}

describe('parseNodes — allocatedProcessors', () => {
  it('uses allocated_processors when present (cgroup-aware Cloud value)', () => {
    const files = new Map([
      ['nodes.json', makeNodesJson('node-1', 'node-1', { allocated_processors: 4, available_processors: 8 })],
      ['nodes_stats.json', makeNodesStatsJson('node-1')],
    ])
    const result = parseNodes(files)
    expect(result[0].allocatedProcessors).toBe(4)
  })

  it('falls back to available_processors when allocated_processors is absent', () => {
    const files = new Map([
      ['nodes.json', makeNodesJson('node-1', 'node-1', { available_processors: 8 })],
      ['nodes_stats.json', makeNodesStatsJson('node-1')],
    ])
    const result = parseNodes(files)
    expect(result[0].allocatedProcessors).toBe(8)
  })

  it('leaves allocatedProcessors undefined when both fields are absent', () => {
    const files = new Map([
      ['nodes.json', makeNodesJson('node-1', 'node-1')],
      ['nodes_stats.json', makeNodesStatsJson('node-1')],
    ])
    const result = parseNodes(files)
    expect(result[0].allocatedProcessors).toBeUndefined()
  })
})

describe('parseNodes — jvmUptimeMs', () => {
  it('parses jvm.uptime_in_millis into jvmUptimeMs', () => {
    const files = new Map([
      ['nodes.json', makeNodesJson('node-1', 'node-1')],
      ['nodes_stats.json', makeNodesStatsJson('node-1')],
    ])
    const result = parseNodes(files)
    expect(result[0].jvmUptimeMs).toBe(4648905099)
  })

  it('leaves jvmUptimeMs undefined when field is absent', () => {
    const files = new Map([
      ['nodes.json', makeNodesJson('node-1', 'node-1')],
      ['nodes_stats.json', makeNodesStatsJson('node-1', { jvm: {} })],
    ])
    const result = parseNodes(files)
    expect(result[0].jvmUptimeMs).toBeUndefined()
  })
})

describe('parseNodes — ramUsed', () => {
  it('parses os.mem.used_in_bytes into ramUsed', () => {
    const files = new Map([
      ['nodes.json', makeNodesJson('node-1', 'node-1')],
      ['nodes_stats.json', makeNodesStatsJson('node-1')],
    ])
    const result = parseNodes(files)
    expect(result[0].ramUsed).toBe(32844574720)
  })

  it('leaves ramUsed undefined when os.mem is absent', () => {
    const files = new Map([
      ['nodes.json', makeNodesJson('node-1', 'node-1')],
      ['nodes_stats.json', makeNodesStatsJson('node-1', { os: {} })],
    ])
    const result = parseNodes(files)
    expect(result[0].ramUsed).toBeUndefined()
  })
})

describe('parseNodes — offHeapBytes', () => {
  it('parses indices.dense_vector.off_heap.total_size_bytes into offHeapBytes', () => {
    const stats = makeNodesStatsJson('node-1', {
      indices: { dense_vector: { value_count: 100, off_heap: { total_size_bytes: 524288000 } } },
    })
    const files = new Map([
      ['nodes.json', makeNodesJson('node-1', 'node-1')],
      ['nodes_stats.json', stats],
    ])
    const result = parseNodes(files)
    expect(result[0].offHeapBytes).toBe(524288000)
  })

  it('leaves offHeapBytes undefined when off_heap object is absent', () => {
    const stats = makeNodesStatsJson('node-1', {
      indices: { dense_vector: { value_count: 0 } },
    })
    const files = new Map([
      ['nodes.json', makeNodesJson('node-1', 'node-1')],
      ['nodes_stats.json', stats],
    ])
    const result = parseNodes(files)
    expect(result[0].offHeapBytes).toBeUndefined()
  })

  it('leaves offHeapBytes undefined when total_size_bytes is 0', () => {
    const stats = makeNodesStatsJson('node-1', {
      indices: { dense_vector: { value_count: 10, off_heap: { total_size_bytes: 0 } } },
    })
    const files = new Map([
      ['nodes.json', makeNodesJson('node-1', 'node-1')],
      ['nodes_stats.json', stats],
    ])
    const result = parseNodes(files)
    expect(result[0].offHeapBytes).toBeUndefined()
  })
})

// ── buildNodeHealthSignals tests ─────────────────────────────────────────────

function makeDataNode(id: string, name: string, ramTotal = 64 * 1024 ** 3): NodeInfo {
  return {
    id, name, ip: '10.0.0.1', roles: ['data_hot'], tier: 'hot',
    allocatedProcessors: 8, ramTotal,
  }
}

function makeSignalsStatsJson(nodeId: string, overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    nodes: {
      [nodeId]: {
        name: nodeId,
        jvm: {
          uptime_in_millis: 86_400_000,
          mem: { heap_used_percent: 70, heap_max_in_bytes: 17179869184 },
          gc: {
            collectors: {
              young: { collection_count: 100, collection_time_in_millis: 5000 },
              old: { collection_count: 2, collection_time_in_millis: 800 },
            },
          },
        },
        os: {
          cpu: { percent: 30, load_average: { '1m': 4.0 } },
          mem: { total_in_bytes: 64 * 1024 ** 3, used_in_bytes: 32 * 1024 ** 3 },
        },
        indices: {
          indexing: { index_time_in_millis: 8_640_000 },  // 10% of uptime
          merges: { total_time_in_millis: 4_320_000 },    // 5% of uptime
          search: { query_total: 1000, query_time_in_millis: 864_000 },  // 1%
          fielddata: { evictions: 42, memory_size_in_bytes: 1048576 },
        },
        indexing_pressure: {
          memory: {
            limit_in_bytes: 10_737_418_240,
            current: { coordinating_and_primary_in_bytes: 0, replica_in_bytes: 0 },
            total: { rejections: { coordinating: 5, primary: 2, replica: 0 } },
          },
        },
        thread_pool: {
          write: { threads: 16, active: 2, queue: 0, rejected: 0, largest: 16 },
          search: { threads: 25, active: 5, queue: 3, rejected: 10, largest: 25 },
          analyze: { threads: 0, active: 0, queue: 0, rejected: 0, largest: 0 },
        },
        breakers: {
          request: { tripped: 0, estimated_size_in_bytes: 0, limit_size_in_bytes: 17179869184 },
          fielddata: { tripped: 3, estimated_size_in_bytes: 1048576, limit_size_in_bytes: 12884901888 },
        },
        allocations: {
          undesired_shards: 2,
          forecasted_disk_usage_in_bytes: 107374182400,
          forecasted_ingest_load: 0.5,
        },
        ...overrides,
      },
    },
  })
}

describe('buildNodeHealthSignals — workload', () => {
  it('computes workload percents from time_in_millis / uptime', () => {
    const node = makeDataNode('node-1', 'node-1')
    const files = new Map([['nodes_stats.json', makeSignalsStatsJson('node-1')]])
    const [sig] = buildNodeHealthSignals(files, [node])
    expect(sig.workload?.indexingPercent).toBeCloseTo(10, 0)
    expect(sig.workload?.mergePercent).toBeCloseTo(5, 0)
    expect(sig.workload?.queryPercent).toBeCloseTo(1, 0)
  })

  it('returns null workload when uptime is 0', () => {
    const node = makeDataNode('node-1', 'node-1')
    const files = new Map([
      ['nodes_stats.json', makeSignalsStatsJson('node-1', { jvm: { uptime_in_millis: 0 } })],
    ])
    const [sig] = buildNodeHealthSignals(files, [node])
    expect(sig.workload).toBeNull()
  })
})

describe('buildNodeHealthSignals — loadPercent', () => {
  it('computes load_percent from load_average.1m / allocatedProcessors', () => {
    const node = makeDataNode('node-1', 'node-1')
    const files = new Map([['nodes_stats.json', makeSignalsStatsJson('node-1')]])
    const [sig] = buildNodeHealthSignals(files, [node])
    // load1m=4.0 / allocProcs=8 * 100 = 50%
    expect(sig.loadPercent).toBeCloseTo(50, 0)
  })

  it('marks loadPercentReliable=false when node RAM < 60 GiB', () => {
    const smallNode = makeDataNode('node-1', 'node-1', 4 * 1024 ** 3)
    const files = new Map([['nodes_stats.json', makeSignalsStatsJson('node-1')]])
    const [sig] = buildNodeHealthSignals(files, [smallNode])
    expect(sig.loadPercentReliable).toBe(false)
  })

  it('marks loadPercentReliable=true when node RAM >= 60 GiB', () => {
    const bigNode = makeDataNode('node-1', 'node-1', 64 * 1024 ** 3)
    const files = new Map([['nodes_stats.json', makeSignalsStatsJson('node-1')]])
    const [sig] = buildNodeHealthSignals(files, [bigNode])
    expect(sig.loadPercentReliable).toBe(true)
  })
})

describe('buildNodeHealthSignals — GC stats', () => {
  it('parses young and old GC counts and times', () => {
    const node = makeDataNode('node-1', 'node-1')
    const files = new Map([['nodes_stats.json', makeSignalsStatsJson('node-1')]])
    const [sig] = buildNodeHealthSignals(files, [node])
    expect(sig.gc?.youngCollectionCount).toBe(100)
    expect(sig.gc?.oldCollectionTimeMs).toBe(800)
  })

  it('returns null gc when jvm.gc is absent', () => {
    const node = makeDataNode('node-1', 'node-1')
    const files = new Map([
      ['nodes_stats.json', makeSignalsStatsJson('node-1', { jvm: { uptime_in_millis: 86400000 } })],
    ])
    const [sig] = buildNodeHealthSignals(files, [node])
    expect(sig.gc).toBeNull()
  })
})

describe('buildNodeHealthSignals — indexing pressure', () => {
  it('parses rejections and sets hasRejections when any rejection > 0', () => {
    const node = makeDataNode('node-1', 'node-1')
    const files = new Map([['nodes_stats.json', makeSignalsStatsJson('node-1')]])
    const [sig] = buildNodeHealthSignals(files, [node])
    expect(sig.indexingPressure?.hasRejections).toBe(true)
    expect(sig.indexingPressure?.totalRejectionsCoordinating).toBe(5)
  })
})

describe('buildNodeHealthSignals — thread pools', () => {
  it('excludes pools with zero activity', () => {
    const node = makeDataNode('node-1', 'node-1')
    const files = new Map([['nodes_stats.json', makeSignalsStatsJson('node-1')]])
    const [sig] = buildNodeHealthSignals(files, [node])
    const poolNames = sig.threadPools.map(tp => tp.pool)
    expect(poolNames).toContain('write')
    expect(poolNames).toContain('search')
    expect(poolNames).not.toContain('analyze')
  })

  it('captures rejected count for search pool', () => {
    const node = makeDataNode('node-1', 'node-1')
    const files = new Map([['nodes_stats.json', makeSignalsStatsJson('node-1')]])
    const [sig] = buildNodeHealthSignals(files, [node])
    const search = sig.threadPools.find(tp => tp.pool === 'search')
    expect(search?.rejected).toBe(10)
  })
})

describe('buildNodeHealthSignals — allocations', () => {
  it('returns NOT_APPLICABLE for non-data nodes', () => {
    const masterNode: NodeInfo = {
      id: 'master-1', name: 'master-1', ip: '10.0.0.1',
      roles: ['master'], tier: 'master',
    }
    const files = new Map([['nodes_stats.json', makeSignalsStatsJson('master-1')]])
    const [sig] = buildNodeHealthSignals(files, [masterNode])
    expect(sig.allocations).toEqual({ unavailable: 'NOT_APPLICABLE' })
  })

  it('returns AllocationForecast for data nodes with allocations field', () => {
    const node = makeDataNode('node-1', 'node-1')
    const files = new Map([['nodes_stats.json', makeSignalsStatsJson('node-1')]])
    const [sig] = buildNodeHealthSignals(files, [node])
    expect((sig.allocations as { undesiredShards: number }).undesiredShards).toBe(2)
  })

  it('returns REQUIRES_ES_8_17 for data nodes without allocations field', () => {
    const node = makeDataNode('node-1', 'node-1')
    const parsed = JSON.parse(makeSignalsStatsJson('node-1'))
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { allocations: _, ...rest } = parsed.nodes['node-1']
    const filesNoAlloc = new Map([
      ['nodes_stats.json', JSON.stringify({ nodes: { 'node-1': rest } })],
    ])
    const [sig] = buildNodeHealthSignals(filesNoAlloc, [node])
    expect(sig.allocations).toEqual({ unavailable: 'REQUIRES_ES_8_17' })
  })
})

describe('buildNodeHealthSignals — fielddata evictions', () => {
  it('parses fielddata evictions', () => {
    const node = makeDataNode('node-1', 'node-1')
    const files = new Map([['nodes_stats.json', makeSignalsStatsJson('node-1')]])
    const [sig] = buildNodeHealthSignals(files, [node])
    expect(sig.fielddataEvictions).toBe(42)
  })
})

describe('buildNodeHealthSignals — missing nodes_stats', () => {
  it('returns empty array when nodes_stats.json is absent', () => {
    const node = makeDataNode('node-1', 'node-1')
    const signals = buildNodeHealthSignals(new Map(), [node])
    expect(signals).toHaveLength(0)
  })

  it('skips nodes not present in nodes_stats', () => {
    const node = makeDataNode('other-node', 'other-node')
    const files = new Map([['nodes_stats.json', makeSignalsStatsJson('node-1')]])
    const signals = buildNodeHealthSignals(files, [node])
    expect(signals).toHaveLength(0)
  })
})
