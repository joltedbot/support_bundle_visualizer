import { describe, it, expect } from 'vitest'
import { parseKibana } from './kibana'

const STATUS_JSON = JSON.stringify({
  version: { number: '8.14.0' },
  name: 'kibana-node-1',
  uuid: 'abc-123',
  status: { overall: { level: 'available' } },
  metrics: {
    process: {
      memory: {
        heap: { used_in_bytes: 300_000_000, total_in_bytes: 400_000_000, size_limit: 1_000_000_000 },
      },
    },
  },
})

const STATS_JSON = JSON.stringify({
  process: {
    memory: {
      heap: { used_bytes: 350_000_000, total_bytes: 500_000_000, size_limit: 1_073_741_824 },
    },
    event_loop_delay: 12.5,
    uptime_ms: 86_400_000,
  },
  concurrent_connections: 42,
  response_times: { avg_ms: 55, max_ms: 200 },
})

const STATS_HISTOGRAM_JSON = JSON.stringify({
  process: {
    memory: {
      heap: { used_bytes: 200_000_000, total_bytes: 300_000_000, size_limit: 500_000_000 },
    },
    event_loop_delay_histogram: { mean: 250 },
    uptime_ms: 3_600_000,
  },
  concurrent_connections: 5,
  response_times: { avg_ms: 30 },
})

describe('parseKibana — new metrics from kibana_stats.json', () => {
  it('overrides heap values from kibana_stats.json when present', () => {
    const files = new Map([
      ['kibana_status.json', STATUS_JSON],
      ['kibana_stats.json', STATS_JSON],
    ])
    const result = parseKibana(files)
    expect(result).not.toBeNull()
    expect(result!.heapUsed).toBe(350_000_000)
    expect(result!.heapSizeLimit).toBe(1_073_741_824)
  })

  it('computes heapPercent from used / size_limit (not used / total)', () => {
    const files = new Map([
      ['kibana_status.json', STATUS_JSON],
      ['kibana_stats.json', STATS_JSON],
    ])
    const result = parseKibana(files)
    expect(result).not.toBeNull()
    // 350_000_000 / 1_073_741_824 * 100 ≈ 32.6 → rounds to 33
    expect(result!.heapPercent).toBe(33)
  })

  it('parses event_loop_delay, uptime, connections, response time', () => {
    const files = new Map([
      ['kibana_status.json', STATUS_JSON],
      ['kibana_stats.json', STATS_JSON],
    ])
    const result = parseKibana(files)
    expect(result!.eventLoopDelayMs).toBe(12.5)
    expect(result!.uptimeMs).toBe(86_400_000)
    expect(result!.concurrentConnections).toBe(42)
    expect(result!.responseTimeAvgMs).toBe(55)
  })

  it('falls back to event_loop_delay_histogram.mean when direct field absent', () => {
    const files = new Map([
      ['kibana_status.json', STATUS_JSON],
      ['kibana_stats.json', STATS_HISTOGRAM_JSON],
    ])
    const result = parseKibana(files)
    expect(result!.eventLoopDelayMs).toBe(250)
  })

  it('returns undefined for new fields when kibana_stats.json is absent', () => {
    const files = new Map([['kibana_status.json', STATUS_JSON]])
    const result = parseKibana(files)
    expect(result).not.toBeNull()
    expect(result!.eventLoopDelayMs).toBeUndefined()
    expect(result!.uptimeMs).toBeUndefined()
    expect(result!.concurrentConnections).toBeUndefined()
    expect(result!.responseTimeAvgMs).toBeUndefined()
  })

  it('still computes heapPercent from kibana_status.json metrics when stats absent', () => {
    const files = new Map([['kibana_status.json', STATUS_JSON]])
    const result = parseKibana(files)
    // 300_000_000 / 1_000_000_000 * 100 = 30
    expect(result!.heapPercent).toBe(30)
  })

  it('clamps heapPercent to 100 when used exceeds size_limit', () => {
    const overflowStats = JSON.stringify({
      process: {
        memory: { heap: { used_bytes: 1_200_000_000, total_bytes: 1_200_000_000, size_limit: 1_000_000_000 } },
        uptime_ms: 1000,
      },
    })
    const files = new Map([
      ['kibana_status.json', STATUS_JSON],
      ['kibana_stats.json', overflowStats],
    ])
    expect(parseKibana(files)!.heapPercent).toBe(100)
  })

  it('returns null when kibana_status.json is absent', () => {
    const files = new Map([['kibana_stats.json', STATS_JSON]])
    expect(parseKibana(files)).toBeNull()
  })
})
