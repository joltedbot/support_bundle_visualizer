import { describe, it, expect } from 'vitest'
import { buildIndexModelMap } from './indexModels'

describe('buildIndexModelMap', () => {
  it('returns an empty map when no files are provided', () => {
    const files = new Map<string, string>()
    expect(buildIndexModelMap(files).size).toBe(0)
  })

  it('extracts models from ingest pipelines via index settings', () => {
    const files = new Map<string, string>()
    files.set('settings.json', JSON.stringify({
      'idx-1': { settings: { index: { default_pipeline: 'pipe-1' } } },
      'idx-2': { settings: { index: { final_pipeline: 'pipe-2' } } },
    }))
    files.set('pipelines.json', JSON.stringify({
      'pipe-1': { processors: [{ inference: { model_id: 'model-a' } }] },
      'pipe-2': { processors: [{ inference: { inference_id: 'model-b' } }] },
    }))

    const result = buildIndexModelMap(files)
    expect(result.get('idx-1')).toEqual(['model-a'])
    expect(result.get('idx-2')).toEqual(['model-b'])
  })

  it('extracts models from mapping inference_id', () => {
    const files = new Map<string, string>()
    files.set('mapping.json', JSON.stringify({
      'idx-3': {
        mappings: {
          properties: {
            'vec': { type: 'dense_vector', inference_id: 'model-c' },
            'text': { type: 'semantic_text', inference_id: 'model-d' }
          }
        }
      }
    }))

    const result = buildIndexModelMap(files)
    expect(result.get('idx-3')).toEqual(['model-c', 'model-d'])
  })

  it('combines models from both sources and sorts them', () => {
    const files = new Map<string, string>()
    files.set('settings.json', JSON.stringify({
      'idx-4': { settings: { index: { default_pipeline: 'pipe-1' } } },
    }))
    files.set('pipelines.json', JSON.stringify({
      'pipe-1': { processors: [{ inference: { model_id: 'model-z' } }] },
    }))
    files.set('mapping.json', JSON.stringify({
      'idx-4': {
        mappings: {
          properties: {
            'vec': { type: 'dense_vector', inference_id: 'model-a' }
          }
        }
      }
    }))

    const result = buildIndexModelMap(files)
    expect(result.get('idx-4')).toEqual(['model-a', 'model-z'])
  })

  it('handles nested mapping properties', () => {
    const files = new Map<string, string>()
    files.set('mapping.json', JSON.stringify({
      'idx-5': {
        mappings: {
          properties: {
            'sub': {
              properties: {
                'vec': { type: 'dense_vector', inference_id: 'model-deep' }
              }
            }
          }
        }
      }
    }))

    const result = buildIndexModelMap(files)
    expect(result.get('idx-5')).toEqual(['model-deep'])
  })
})
