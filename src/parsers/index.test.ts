import { describe, it, expect } from 'vitest'
import { parseBundle } from './index'

function makeFiles(overrides: Record<string, unknown> = {}): Map<string, string> {
  const nodeId = 'abc123'
  const nodeName = 'node-hot-1'

  const defaults: Record<string, unknown> = {
    'nodes.json': {
      nodes: {
        [nodeId]: { name: nodeName, ip: '10.0.0.1', roles: ['data_hot'] },
      },
    },
    'cat/cat_shards.txt': [
      'index shard prirep state   docs  store dataset node',
      `my-index 0     p      STARTED 1000 50mb  50mb    ${nodeName}`,
    ].join('\n'),
  }

  const merged: Record<string, unknown> = { ...defaults, ...overrides }
  const files = new Map<string, string>()
  for (const [k, v] of Object.entries(merged)) {
    files.set(k, typeof v === 'string' ? v : JSON.stringify(v))
  }
  return files
}

describe('parseBundle — shard→node join by ID', () => {
  it('resolves shard nodeId to the matching node ID', async () => {
    const files = makeFiles()
    const model = await parseBundle({ files, rootName: 'test' })
    const shard = model.shards.find(s => s.index === 'my-index')
    expect(shard?.nodeId).toBe('abc123')
  })

  it('leaves nodeId undefined when node name does not match any node', async () => {
    const files = makeFiles({
      'cat/cat_shards.txt': [
        'index shard prirep state   docs  store dataset node',
        'my-index 0     p      STARTED 1000 50mb  50mb    unknown-node',
      ].join('\n'),
    })
    const model = await parseBundle({ files, rootName: 'test' })
    const shard = model.shards.find(s => s.index === 'my-index')
    expect(shard?.nodeId).toBeUndefined()
  })

  it('counts shards by node ID, not name', async () => {
    const files = makeFiles()
    const model = await parseBundle({ files, rootName: 'test' })
    const node = model.nodes.find(n => n.id === 'abc123')
    expect(node?.shardCount).toBe(1)
  })

  it('does not backfill shardCount from a failed join', async () => {
    const files = makeFiles({
      'cat/cat_shards.txt': [
        'index shard prirep state   docs  store dataset node',
        'my-index 0     p      STARTED 1000 50mb  50mb    wrong-name',
      ].join('\n'),
    })
    const model = await parseBundle({ files, rootName: 'test' })
    // Node should have shardCount = 0 (data-tier default), not picking up the unjoined shard
    const node = model.nodes.find(n => n.id === 'abc123')
    expect(node?.shardCount).toBe(0)
  })
})

describe('parseBundle — LogsDB detection', () => {
  const CAT_HEADER = 'health status index pri rep docs.count store.size pri.store.size'

  it('sets isLogsDb=true when index.mode=logsdb', async () => {
    const files = makeFiles({
      'cat/cat_indices.txt': [CAT_HEADER, 'green open my-logsdb-index 1 1 1000 50mb 25mb'].join('\n'),
      'settings.json': {
        'my-logsdb-index': {
          settings: { index: { mode: 'logsdb' } },
        },
      },
    })
    const model = await parseBundle({ files, rootName: 'test' })
    const idx = model.indices.find(i => i.name === 'my-logsdb-index')
    expect(idx?.isLogsDb).toBe(true)
  })

  it('sets isLogsDb=true when mapping.source.mode=synthetic', async () => {
    const files = makeFiles({
      'cat/cat_indices.txt': [CAT_HEADER, 'green open my-synthetic-index 1 1 1000 50mb 25mb'].join('\n'),
      'settings.json': {
        'my-synthetic-index': {
          settings: { index: { mapping: { source: { mode: 'synthetic' } } } },
        },
      },
    })
    const model = await parseBundle({ files, rootName: 'test' })
    const idx = model.indices.find(i => i.name === 'my-synthetic-index')
    expect(idx?.isLogsDb).toBe(true)
  })

  it('does not set isLogsDb for standard indices', async () => {
    const files = makeFiles({
      'cat/cat_indices.txt': [CAT_HEADER, 'green open my-standard-index 1 1 1000 50mb 25mb'].join('\n'),
      'settings.json': {
        'my-standard-index': {
          settings: { index: { mode: 'standard' } },
        },
      },
    })
    const model = await parseBundle({ files, rootName: 'test' })
    const idx = model.indices.find(i => i.name === 'my-standard-index')
    expect(idx?.isLogsDb).toBeUndefined()
  })
})
