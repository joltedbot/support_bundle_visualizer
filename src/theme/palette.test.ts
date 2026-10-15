import { describe, it, expect } from 'vitest'
import { levelBadgeColor, SOLUTION_BADGE_COLORS } from './palette'

describe('levelBadgeColor', () => {
  it.each([
    ['green', 'success'], ['ok', 'success'], ['OK', 'success'],
    ['yellow', 'warning'], ['warn', 'warning'],
    ['red', 'danger'], ['error', 'danger'],
    ['unknown', 'default'], [null, 'default'], [undefined, 'default'],
  ])('%s -> %s', (level, expected) => {
    expect(levelBadgeColor(level)).toBe(expected)
  })
})

describe('SOLUTION_BADGE_COLORS', () => {
  it('uses a distinct colour per solution', () => {
    const colours = Object.values(SOLUTION_BADGE_COLORS)
    expect(new Set(colours).size).toBe(colours.length)
  })
})
