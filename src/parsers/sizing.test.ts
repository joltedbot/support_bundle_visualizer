import { describe, it, expect } from 'vitest'
import { parseSizing } from './sizing'

const TWO_DAYS_MS = 2 * 86_400_000

function nodesStats(uptimeMs: number): string {
  return JSON.stringify({
    nodes: {
      node1: {
        jvm: { uptime_in_millis: uptimeMs },
        indices: { search: { query_total: 1000 } },
      },
    },
  })
}

function indicesStats(primariesBulkBytes: number | null): string {
  return JSON.stringify({
    _all: {
      primaries: {
        bulk: primariesBulkBytes === null ? {} : { total_size_in_bytes: primariesBulkBytes },
      },
    },
  })
}

describe('parseSizing — bulk ingest rate', () => {
  it('computes bulk rate from primaries bulk size ÷ node uptime', () => {
    const files = new Map([
      ['nodes_stats.json', nodesStats(TWO_DAYS_MS)],
      ['indices_stats.json', indicesStats(20 * 1_073_741_824)],
    ])
    const result = parseSizing(files, [])
    expect(result?.bulkIngestRateBytesPerDay).toBeCloseTo(10 * 1_073_741_824, 0)
  })

  it('returns null bulk rate when indices_stats.json is absent', () => {
    const files = new Map([['nodes_stats.json', nodesStats(TWO_DAYS_MS)]])
    const result = parseSizing(files, [])
    expect(result?.bulkIngestRateBytesPerDay).toBeNull()
  })

  it('returns null bulk rate when node uptime is absent (zero)', () => {
    const files = new Map([
      ['nodes_stats.json', nodesStats(0)],
      ['indices_stats.json', indicesStats(20 * 1_073_741_824)],
    ])
    const result = parseSizing(files, [])
    expect(result?.nodeUptimeDays).toBeNull()
    expect(result?.bulkIngestRateBytesPerDay).toBeNull()
  })

  it('returns null bulk rate when primaries bulk size is missing or zero', () => {
    const missing = new Map([
      ['nodes_stats.json', nodesStats(TWO_DAYS_MS)],
      ['indices_stats.json', indicesStats(null)],
    ])
    expect(parseSizing(missing, [])?.bulkIngestRateBytesPerDay).toBeNull()

    const zero = new Map([
      ['nodes_stats.json', nodesStats(TWO_DAYS_MS)],
      ['indices_stats.json', indicesStats(0)],
    ])
    expect(parseSizing(zero, [])?.bulkIngestRateBytesPerDay).toBeNull()
  })

  it('returns null bulk rate when indices_stats.json lacks _all/primaries entirely', () => {
    const files = new Map([
      ['nodes_stats.json', nodesStats(TWO_DAYS_MS)],
      ['indices_stats.json', JSON.stringify({ indices: {} })],
    ])
    expect(parseSizing(files, [])?.bulkIngestRateBytesPerDay).toBeNull()
  })
})
