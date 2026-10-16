import { describe, it, expect } from 'vitest'
import { parseShards } from './shards'

function makeShardFile(rows: string[]): Map<string, string> {
  const header = 'index shard prirep state docs store dataset node'
  const content = [header, ...rows].join('\n')
  return new Map([['cat/cat_shards.txt', content]])
}

describe('parseShards', () => {
  it('parses columns into a ShardInfo', () => {
    const [shard] = parseShards(makeShardFile(['my-index 2 r STARTED 1000 60gb 70gb node-2']))
    expect(shard).toEqual({
      index: 'my-index',
      shard: 2,
      prirep: 'r',
      state: 'STARTED',
      node: 'node-2',
      storeSizeBytes: 60 * 1024 ** 3,
      datasetSizeBytes: 70 * 1024 ** 3,
    })
  })

  it('returns an empty array when the file is missing', () => {
    expect(parseShards(new Map())).toEqual([])
  })
})
