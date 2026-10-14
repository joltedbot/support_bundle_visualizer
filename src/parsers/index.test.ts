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

describe('parseBundle — index mode', () => {
  const CAT_HEADER = 'health status index pri rep docs.count store.size pri.store.size'
  const catFor = (name: string) => [CAT_HEADER, `green open ${name} 1 1 1000 50mb 25mb`].join('\n')

  it('sets indexMode=logsdb when index.mode=logsdb', async () => {
    const files = makeFiles({
      'cat/cat_indices.txt': catFor('my-logsdb-index'),
      'settings.json': { 'my-logsdb-index': { settings: { index: { mode: 'logsdb' } } } },
    })
    const model = await parseBundle({ files, rootName: 'test' })
    expect(model.indices.find(i => i.name === 'my-logsdb-index')?.indexMode).toBe('logsdb')
  })

  it('flags syntheticSource without calling the index LogsDB', async () => {
    const files = makeFiles({
      'cat/cat_indices.txt': catFor('my-synthetic-index'),
      'settings.json': {
        'my-synthetic-index': { settings: { index: { mapping: { source: { mode: 'synthetic' } } } } },
      },
    })
    const model = await parseBundle({ files, rootName: 'test' })
    const idx = model.indices.find(i => i.name === 'my-synthetic-index')
    expect(idx?.syntheticSource).toBe(true)
    expect(idx?.indexMode).toBe('standard')
  })

  it('reports standard for indices with no mode and no synthetic flag', async () => {
    const files = makeFiles({
      'cat/cat_indices.txt': catFor('my-standard-index'),
      'settings.json': { 'my-standard-index': { settings: { index: {} } } },
    })
    const model = await parseBundle({ files, rootName: 'test' })
    const idx = model.indices.find(i => i.name === 'my-standard-index')
    expect(idx?.indexMode).toBe('standard')
    expect(idx?.syntheticSource).toBe(false)
    expect(idx?.vector).toBeNull()
  })
})

describe('parseBundle — index traits propagation', () => {
  const CAT_HEADER = 'health status index pri rep docs.count store.size pri.store.size'

  it('leaves indexMode and vector null for an index with no settings or mapping entry', async () => {
    const files = makeFiles({ 'cat/cat_indices.txt': [CAT_HEADER, 'green open bare-index 1 1 10 1mb 1mb'].join('\n') })
    const idx = (await parseBundle({ files, rootName: 'test' })).indices.find(i => i.name === 'bare-index')
    expect(idx?.indexMode).toBeNull()
    expect(idx?.vector).toBeNull()
    expect(idx?.syntheticSource).toBe(false)
  })

  it('propagates vector traits from mapping.json onto the index', async () => {
    const files = makeFiles({
      'cat/cat_indices.txt': [CAT_HEADER, 'green open vec-index 1 1 10 1mb 1mb'].join('\n'),
      'mapping.json': { 'vec-index': { mappings: { properties: { v: { type: 'dense_vector', index_options: { type: 'bbq_hnsw' } } } } } },
    })
    const idx = (await parseBundle({ files, rootName: 'test' })).indices.find(i => i.name === 'vec-index')
    expect(idx?.vector).toEqual({ dense: true, sparse: false, semantic: false, denseTypes: ['bbq_hnsw'] })
  })
})

describe('parseBundle — data adoption', () => {
  const CAT_HEADER = 'health status index pri rep docs.count store.size pri.store.size'

  it('builds adoption rows from primary docs and storage', async () => {
    const files = makeFiles({
      'cat/cat_indices.txt': [
        CAT_HEADER,
        'green open .ds-logs-app-default-2026.01.01-000001 1 1 1000 50mb 25mb',
        'green open products 1 1 10 1mb 512kb',
        'green open .kibana_1 1 0 5 1mb 1mb',
      ].join('\n'),
    })
    const model = await parseBundle({ files, rootName: 'test' })
    expect(model.dataAdoption?.rows.map(r => [r.kind, r.indexCount, r.docCount])).toEqual([
      ['logs', 1, 1000],
      ['other', 1, 10],
    ])
    expect(model.dataAdoption?.rows[0].primaryStoreSizeBytes).toBe(25 * 1024 * 1024)
  })

  it('is null when no indices qualify', async () => {
    const model = await parseBundle({ files: makeFiles(), rootName: 'test' })
    expect(model.dataAdoption).toBeNull()
  })
})
