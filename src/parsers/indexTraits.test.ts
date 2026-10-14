import { describe, it, expect } from 'vitest'
import { parseIndexTraits } from './indexTraits'

function files(settings?: unknown, mapping?: unknown): Map<string, string> {
  const m = new Map<string, string>()
  if (settings !== undefined) m.set('settings.json', JSON.stringify(settings))
  if (mapping !== undefined) m.set('mapping.json', JSON.stringify(mapping))
  return m
}

const withMode = (mode?: string) => ({ settings: { index: mode ? { mode } : {} } })

describe('parseIndexTraits — index mode', () => {
  it('defaults to standard when index.mode is absent', () => {
    const t = parseIndexTraits(files({ a: withMode() }))
    expect(t.get('a')?.indexMode).toBe('standard')
  })

  it.each(['standard', 'logsdb', 'time_series', 'lookup'])('keeps %s verbatim', (mode) => {
    const t = parseIndexTraits(files({ a: withMode(mode) }))
    expect(t.get('a')?.indexMode).toBe(mode)
  })

  it('keeps an unknown mode verbatim', () => {
    const t = parseIndexTraits(files({ a: withMode('future_mode') }))
    expect(t.get('a')?.indexMode).toBe('future_mode')
  })
})

describe('parseIndexTraits — no settings entry', () => {
  it('leaves indexMode null for a mapping-only index', () => {
    const mapping = { a: { mappings: { properties: { message: { type: 'text' } } } } }
    expect(parseIndexTraits(files(undefined, mapping)).get('a')?.indexMode).toBeNull()
  })

  it('leaves indexMode null when settings.json lacks the index but mapping has it', () => {
    const mapping = { b: { mappings: { properties: {} } } }
    expect(parseIndexTraits(files({ a: withMode('logsdb') }, mapping)).get('b')?.indexMode).toBeNull()
  })
})

describe('parseIndexTraits — synthetic source', () => {
  it('detects synthetic source from settings', () => {
    const t = parseIndexTraits(files({ a: { settings: { index: { mapping: { source: { mode: 'synthetic' } } } } } }))
    expect(t.get('a')?.syntheticSource).toBe(true)
  })

  it('detects synthetic source from mapping _source.mode', () => {
    const t = parseIndexTraits(files(undefined, { a: { mappings: { _source: { mode: 'synthetic' }, properties: {} } } }))
    expect(t.get('a')?.syntheticSource).toBe(true)
  })

  it('is false for a standard index', () => {
    const t = parseIndexTraits(files({ a: withMode() }))
    expect(t.get('a')?.syntheticSource).toBe(false)
  })
})

describe('parseIndexTraits — data_stream.type', () => {
  it('reads the constant_keyword value', () => {
    const mapping = {
      a: { mappings: { properties: { data_stream: { properties: { type: { type: 'constant_keyword', value: 'metrics' } } } } } },
    }
    expect(parseIndexTraits(files(undefined, mapping)).get('a')?.dataStreamType).toBe('metrics')
  })

  it('keeps a custom type verbatim', () => {
    const mapping = {
      a: { mappings: { properties: { data_stream: { properties: { type: { type: 'constant_keyword', value: 'arch' } } } } } },
    }
    expect(parseIndexTraits(files(undefined, mapping)).get('a')?.dataStreamType).toBe('arch')
  })

  it('is undefined when the field is not mapped', () => {
    const mapping = { a: { mappings: { properties: { message: { type: 'text' } } } } }
    expect(parseIndexTraits(files(undefined, mapping)).get('a')?.dataStreamType).toBeUndefined()
  })
})

describe('parseIndexTraits — vector', () => {
  it('records dense_vector with its index_options type', () => {
    const mapping = { a: { mappings: { properties: { v: { type: 'dense_vector', index_options: { type: 'int8_hnsw' } } } } } }
    expect(parseIndexTraits(files(undefined, mapping)).get('a')?.vector).toEqual({
      dense: true, sparse: false, semantic: false, denseTypes: ['int8_hnsw'],
    })
  })

  it('defaults dense_vector without index_options to hnsw', () => {
    const mapping = { a: { mappings: { properties: { v: { type: 'dense_vector' } } } } }
    expect(parseIndexTraits(files(undefined, mapping)).get('a')?.vector?.denseTypes).toEqual(['hnsw'])
  })

  it('ignores a non-string index_options.type and uses hnsw', () => {
    const mapping = { a: { mappings: { properties: { v: { type: 'dense_vector', index_options: { type: { x: 1 } } } } } } }
    expect(parseIndexTraits(files(undefined, mapping)).get('a')?.vector?.denseTypes).toEqual(['hnsw'])
  })

  it('detects sparse_vector and semantic_text, including nested fields', () => {
    const mapping = {
      a: {
        mappings: {
          properties: {
            outer: { properties: { s: { type: 'sparse_vector' } } },
            title: { type: 'text', fields: { sem: { type: 'semantic_text' } } },
          },
        },
      },
    }
    const v = parseIndexTraits(files(undefined, mapping)).get('a')?.vector
    expect(v?.sparse).toBe(true)
    expect(v?.semantic).toBe(true)
    expect(v?.dense).toBe(false)
  })

  it('leaves vector undefined when there are no vector fields', () => {
    const mapping = { a: { mappings: { properties: { message: { type: 'text' } } } } }
    expect(parseIndexTraits(files(undefined, mapping)).get('a')?.vector).toBeUndefined()
  })

  it('does not recurse past the depth limit', () => {
    let node: Record<string, unknown> = { v: { type: 'dense_vector' } }
    for (let i = 0; i < 15; i++) node = { n: { properties: node } }
    const mapping = { a: { mappings: { properties: node } } }
    expect(parseIndexTraits(files(undefined, mapping)).get('a')?.vector).toBeUndefined()
  })
})

describe('parseIndexTraits — defensive', () => {
  it('returns an empty map when no files exist', () => {
    expect(parseIndexTraits(new Map()).size).toBe(0)
  })

  it('does not throw on malformed JSON or odd shapes', () => {
    const m = new Map<string, string>([['settings.json', '{nope'], ['mapping.json', JSON.stringify({ a: null, b: { mappings: 5 } })]])
    expect(() => parseIndexTraits(m)).not.toThrow()
  })
})
