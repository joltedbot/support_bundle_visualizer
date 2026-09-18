import { describe, it, expect } from 'vitest'
import { parseShards } from './shards'

function makeShardFile(rows: string[]): Map<string, string> {
  const header = 'index shard prirep state docs store dataset node'
  const content = [header, ...rows].join('\n')
  return new Map([['cat/cat_shards.txt', content]])
}

describe('parseShards — oversized/undersized flags (primaries only)', () => {
  it('flags an oversized primary shard', () => {
    const files = makeShardFile(['my-index 0 p STARTED 1000 60gb 60gb node-1'])
    const shards = parseShards(files)
    expect(shards[0].oversized).toBe(true)
    expect(shards[0].undersized).toBe(false)
  })

  it('does NOT flag an oversized replica shard', () => {
    const files = makeShardFile(['my-index 0 r STARTED 1000 60gb 60gb node-2'])
    const shards = parseShards(files)
    expect(shards[0].oversized).toBe(false)
  })

  it('flags an undersized primary shard', () => {
    const files = makeShardFile(['my-index 0 p STARTED 100 500mb 500mb node-1'])
    const shards = parseShards(files)
    expect(shards[0].undersized).toBe(true)
    expect(shards[0].oversized).toBe(false)
  })

  it('does NOT flag an undersized replica shard', () => {
    const files = makeShardFile(['my-index 0 r STARTED 100 500mb 500mb node-2'])
    const shards = parseShards(files)
    expect(shards[0].undersized).toBe(false)
  })

  it('sets both flags false for an empty primary shard (0 bytes)', () => {
    const files = makeShardFile(['my-index 0 p STARTED 0 0b 0b node-1'])
    const shards = parseShards(files)
    expect(shards[0].oversized).toBe(false)
    expect(shards[0].undersized).toBe(false)
  })
})
