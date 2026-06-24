import { describe, it, expect } from 'vitest'
import { parseShards } from './shards'

const OVERSIZED_BYTES = 50 * 1024 * 1024 * 1024  // 53687091200
const UNDERSIZED_BYTES = 1 * 1024 * 1024 * 1024  // 1073741824

// Build a minimal cat_shards.txt with a single data row
function makeCatShards(rows: Array<{
  index?: string
  shard?: number
  prirep?: 'p' | 'r'
  state?: string
  store?: string
  node?: string
}>): Map<string, string> {
  const header = 'index shard prirep state docs store dataset ip node'
  const lines = rows.map(r => [
    r.index ?? 'test-index',
    r.shard ?? 0,
    r.prirep ?? 'p',
    r.state ?? 'STARTED',
    '100',                                          // docs
    r.store !== undefined ? r.store : '1gb',        // store
    '-',                                            // dataset
    '127.0.0.1',                                    // ip
    r.node ?? 'node-1',
  ].join(' '))
  return new Map([['cat/cat_shards.txt', [header, ...lines].join('\n')]])
}

// ── absence/empty ─────────────────────────────────────────────────────────────

describe('parseShards — absent / empty file', () => {
  it('returns empty array when cat_shards.txt is absent', () => {
    expect(parseShards(new Map())).toEqual([])
  })

  it('returns empty array when file has only a header (no data rows)', () => {
    const files = new Map([
      ['cat/cat_shards.txt', 'index shard prirep state docs store dataset ip node'],
    ])
    expect(parseShards(files)).toEqual([])
  })
})

// ── oversized threshold (50 GB) ───────────────────────────────────────────────

describe('parseShards — oversized threshold', () => {
  it('shard exactly at 50 GB is NOT flagged as oversized', () => {
    // 53687091200 bytes = 50 × 1024³ exactly
    const files = makeCatShards([{ store: `${OVERSIZED_BYTES}b` }])
    const result = parseShards(files)
    expect(result[0].storeSizeBytes).toBe(OVERSIZED_BYTES)
    expect(result[0].oversized).toBe(false)
  })

  it('shard at 50 GB + 1 byte IS flagged as oversized', () => {
    const files = makeCatShards([{ store: `${OVERSIZED_BYTES + 1}b` }])
    const result = parseShards(files)
    expect(result[0].oversized).toBe(true)
  })

  it('large shard expressed as "51gb" IS flagged as oversized', () => {
    const files = makeCatShards([{ store: '51gb' }])
    const result = parseShards(files)
    expect(result[0].oversized).toBe(true)
  })
})

// ── undersized threshold (1 GB, primary shards only) ─────────────────────────

describe('parseShards — undersized threshold', () => {
  it('primary shard at 1 GB − 1 byte IS flagged as undersized', () => {
    const files = makeCatShards([{ prirep: 'p', store: `${UNDERSIZED_BYTES - 1}b` }])
    const result = parseShards(files)
    expect(result[0].undersized).toBe(true)
  })

  it('primary shard exactly at 1 GB is NOT flagged as undersized', () => {
    const files = makeCatShards([{ prirep: 'p', store: `${UNDERSIZED_BYTES}b` }])
    const result = parseShards(files)
    expect(result[0].undersized).toBe(false)
  })

  it('replica shard at < 1 GB is NOT flagged as undersized (primaries only)', () => {
    const files = makeCatShards([{ prirep: 'r', store: `${UNDERSIZED_BYTES - 1}b` }])
    const result = parseShards(files)
    expect(result[0].prirep).toBe('r')
    expect(result[0].undersized).toBe(false)
  })

  it('empty shard (0 bytes) is NOT flagged as undersized', () => {
    const files = makeCatShards([{ prirep: 'p', store: '0b' }])
    const result = parseShards(files)
    expect(result[0].undersized).toBe(false)
  })
})

// ── missing / malformed store field ──────────────────────────────────────────

describe('parseShards — missing or malformed fields', () => {
  it('shard with "-" store size is handled gracefully (0 bytes, not flagged)', () => {
    const files = makeCatShards([{ store: '-' }])
    const result = parseShards(files)
    expect(result[0].storeSizeBytes).toBe(0)
    expect(result[0].oversized).toBe(false)
    expect(result[0].undersized).toBe(false)
  })

  it('parses multiple shards correctly', () => {
    const files = makeCatShards([
      { index: 'idx', shard: 0, prirep: 'p', store: '60gb' },
      { index: 'idx', shard: 0, prirep: 'r', store: '60gb' },
      { index: 'idx', shard: 1, prirep: 'p', store: '500mb' },
    ])
    const result = parseShards(files)
    expect(result).toHaveLength(3)
    // primary 60gb → oversized
    expect(result[0].oversized).toBe(true)
    expect(result[0].undersized).toBe(false)
    // replica 60gb → oversized (oversized check applies to all), not undersized
    expect(result[1].oversized).toBe(true)
    expect(result[1].undersized).toBe(false)
    // primary 500mb → undersized
    expect(result[2].oversized).toBe(false)
    expect(result[2].undersized).toBe(true)
  })
})
