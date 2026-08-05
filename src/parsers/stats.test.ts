import { describe, it, expect } from 'vitest'
import { parseStats } from './stats'

function makeStatsJson(deletedCount?: number): string {
  return JSON.stringify({
    indices: {
      store: { size_in_bytes: 1073741824 },
      docs: { count: 1000000, ...(deletedCount !== undefined ? { deleted: deletedCount } : {}) },
      search: { total: 5000 },
      fielddata: { memory_size_in_bytes: 512000 },
      segments: { count: 200 },
    },
  })
}

describe('parseStats — deletedDocCount', () => {
  it('parses indices.docs.deleted into deletedDocCount', () => {
    const files = new Map([['cluster_stats.json', makeStatsJson(2573919)]])
    const result = parseStats(files)
    expect(result?.deletedDocCount).toBe(2573919)
  })

  it('returns 0 for deletedDocCount when deleted field is absent', () => {
    const files = new Map([['cluster_stats.json', makeStatsJson()]])
    const result = parseStats(files)
    expect(result?.deletedDocCount).toBe(0)
  })
})
