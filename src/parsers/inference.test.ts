import { describe, it, expect } from 'vitest'
import { parseInferenceEndpoints } from './inference'

const files = (models: unknown) =>
  new Map([['cluster_state.json', JSON.stringify({ metadata: { model_registry: { models } } })]])

describe('parseInferenceEndpoints', () => {
  it('lists user-created endpoints and counts built-in ones', () => {
    const result = parseInferenceEndpoints(
      files({
        '.rainbow-sprinkles-elastic': { service: 'elastic', task_type: 'chat_completion' },
        '.elser-2-elastic': { service: 'elastic', task_type: 'sparse_embedding' },
        'cohere-completion-abc': { service: 'cohere', task_type: 'completion' },
        'jinaai-embedding-xyz': { service: 'jinaai', task_type: 'embedding', dimensions: 768 },
      }),
      ['jinaai-embedding-xyz']
    )
    expect(result?.builtInCount).toBe(2)
    expect(result?.endpoints).toEqual([
      { id: 'cohere-completion-abc', service: 'cohere', taskType: 'completion', inUse: false },
      { id: 'jinaai-embedding-xyz', service: 'jinaai', taskType: 'embedding', inUse: true },
    ])
  })

  it('excludes endpoints that run on the cluster itself', () => {
    const result = parseInferenceEndpoints(
      files({
        'my-e5': { service: 'elasticsearch', task_type: 'text_embedding' },
        'my-elser': { service: 'elser', task_type: 'sparse_embedding' },
        'my-openai': { service: 'openai', task_type: 'completion' },
      }),
      []
    )
    expect(result?.endpoints.map(e => e.id)).toEqual(['my-openai'])
  })

  it('returns an inventory with no endpoints when only built-in ones exist', () => {
    const result = parseInferenceEndpoints(files({ '.elser-2-elastic': { service: 'elastic', task_type: 'sparse_embedding' } }), [])
    expect(result).toEqual({ endpoints: [], builtInCount: 1 })
  })

  it('returns null when the file, section or models are missing', () => {
    expect(parseInferenceEndpoints(new Map(), [])).toBeNull()
    expect(parseInferenceEndpoints(files(undefined), [])).toBeNull()
    expect(parseInferenceEndpoints(files({}), [])).toBeNull()
  })

  it('never throws on wrong-shaped entries', () => {
    const result = parseInferenceEndpoints(files({ a: null, b: 'x', c: { service: 5 } }), [])
    expect(result?.endpoints.map(e => e.id)).toEqual(['a', 'b', 'c'])
    expect(parseInferenceEndpoints(new Map([['cluster_state.json', '[1,'  ]]), [])).toBeNull()
  })
})
