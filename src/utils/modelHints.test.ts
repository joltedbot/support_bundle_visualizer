import { describe, it, expect } from 'vitest'
import { getModelHint, enrichModelLabel } from './modelHints'

describe('modelHints', () => {
  describe('getModelHint', () => {
    it('returns hint for known dimensions', () => {
      expect(getModelHint(384)).toBe('E5-small / MiniLM / BGE-small')
      expect(getModelHint(1536)).toBe('OpenAI ada-002 / text-embedding-3-small / Voyage-code')
    })

    it('returns null for unknown dimensions', () => {
      expect(getModelHint(123)).toBeNull()
    })
  })

  describe('enrichModelLabel', () => {
    it('enriches external dense vector labels with hints', () => {
      expect(enrichModelLabel('External - Dense - 1536dims')).toBe('1536 (OpenAI ada-002 / text-embedding-3-small / Voyage-code)')
      expect(enrichModelLabel('External - Dense - 384dims')).toBe('384 (E5-small / MiniLM / BGE-small)')
    })

    it('uses fallback format for unknown dimensions', () => {
      expect(enrichModelLabel('External - Dense - 123dims')).toBe('123 dims')
    })

    it('leaves native model IDs unchanged', () => {
      expect(enrichModelLabel('.elser_model_2')).toBe('.elser_model_2')
      expect(enrichModelLabel('some-custom-inference-id')).toBe('some-custom-inference-id')
    })
  })
})
