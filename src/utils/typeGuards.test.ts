import { describe, it, expect } from 'vitest'
import { isOneOf } from './typeGuards'

describe('isOneOf', () => {
  const allowed = ['name', 'status'] as const
  it('accepts listed values', () => {
    expect(isOneOf(allowed, 'name')).toBe(true)
  })
  it('rejects unlisted and non-string values', () => {
    expect(isOneOf(allowed, 'other')).toBe(false)
    expect(isOneOf(allowed, undefined)).toBe(false)
    expect(isOneOf(allowed, 3)).toBe(false)
  })
})
