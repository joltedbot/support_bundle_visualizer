import { describe, it, expect } from 'vitest'
import { parseNodes } from './nodes'

function makeNodesJson(nodeId: string, nodeName: string): string {
  return JSON.stringify({
    nodes: {
      [nodeId]: { name: nodeName, ip: '10.0.0.1', roles: ['data_hot'] },
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
