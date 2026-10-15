import { describe, it, expect } from 'vitest'
import { parseSize } from './parseSize'

describe('parseSize', () => {
  it.each([
    ['1b', 1],
    ['1kb', 1024],
    ['50mb', 50 * 1024 ** 2],
    ['1.5gb', Math.round(1.5 * 1024 ** 3)],
    ['2TB', 2 * 1024 ** 4],
    [' 3mb ', 3 * 1024 ** 2],
    ['512', 512],
  ])('parses %s', (input, expected) => {
    expect(parseSize(input)).toBe(expected)
  })

  it.each(['', '-', 'garbage', 'mb'])('returns 0 for %j', input => {
    expect(parseSize(input)).toBe(0)
  })
})
