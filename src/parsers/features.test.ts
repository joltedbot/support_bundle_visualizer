import { describe, it, expect } from 'vitest'
import { parseFeatures } from './features'

describe('parseFeatures — semantic/vector index counts', () => {
  it('returns zero counts when mapping.json is absent', () => {
    const result = parseFeatures(new Map(), [])
    expect(result?.semanticTextIndexCount).toBe(0)
    expect(result?.denseVectorIndexCount).toBe(0)
    expect(result?.sparseVectorIndexCount).toBe(0)
    expect(result?.semanticTextIndexNames).toEqual([])
  })

  it('counts indices with semantic_text fields', () => {
    const mapping = {
      'idx-a': { mappings: { properties: { f: { type: 'semantic_text', inference_id: 'elser' } } } },
      'idx-b': { mappings: { properties: { f: { type: 'keyword' } } } },
      'idx-c': { mappings: { properties: { f: { type: 'semantic_text', inference_id: 'e5' } } } },
    }
    const files = new Map([['mapping.json', JSON.stringify(mapping)]])
    const result = parseFeatures(files, [])
    expect(result?.semanticTextIndexCount).toBe(2)
    expect(result?.semanticTextIndexNames).toContain('idx-a')
    expect(result?.semanticTextIndexNames).toContain('idx-c')
    expect(result?.semanticTextIndexNames).not.toContain('idx-b')
    expect(result?.hasSemanticText).toBe(true)
  })

  it('counts indices with dense_vector fields', () => {
    const mapping = {
      'idx-vec': { mappings: { properties: { emb: { type: 'dense_vector', dims: 384 } } } },
    }
    const files = new Map([['mapping.json', JSON.stringify(mapping)]])
    const result = parseFeatures(files, [])
    expect(result?.denseVectorIndexCount).toBe(1)
    expect(result?.hasVectorSearch).toBe(true)
  })

  it('counts indices with sparse_vector fields', () => {
    const mapping = {
      'idx-sparse': { mappings: { properties: { tokens: { type: 'sparse_vector' } } } },
    }
    const files = new Map([['mapping.json', JSON.stringify(mapping)]])
    const result = parseFeatures(files, [])
    expect(result?.sparseVectorIndexCount).toBe(1)
    expect(result?.hasVectorSearch).toBe(true)
  })

  it('counts all matching indices without early exit', () => {
    // All three types present in idx-1 — old early exit would have stopped scanning after idx-1
    const mapping = {
      'idx-1': { mappings: { properties: { a: { type: 'semantic_text', inference_id: 'x' }, b: { type: 'dense_vector', dims: 384 }, c: { type: 'sparse_vector' } } } },
      'idx-2': { mappings: { properties: { a: { type: 'semantic_text', inference_id: 'y' } } } },
    }
    const files = new Map([['mapping.json', JSON.stringify(mapping)]])
    const result = parseFeatures(files, [])
    expect(result?.semanticTextIndexCount).toBe(2)
  })

  it('detects semantic_text in nested properties', () => {
    const mapping = {
      'idx-nested': { mappings: { properties: { outer: { properties: { inner: { type: 'semantic_text', inference_id: 'elser' } } } } } },
    }
    const files = new Map([['mapping.json', JSON.stringify(mapping)]])
    expect(parseFeatures(files, [])?.semanticTextIndexCount).toBe(1)
  })
})
