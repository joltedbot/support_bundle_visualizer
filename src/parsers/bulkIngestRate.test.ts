import { describe, it, expect } from 'vitest'
import { parseBulkIngestRate } from './bulkIngestRate'

// Fixed "now" used across all tests
const T_COLLECTION = 1_000_000_000_000

function manifest(timestamp = new Date(T_COLLECTION).toISOString()): string {
  return JSON.stringify({ timestamp })
}

function indicesStats(entries: Record<string, { bulk?: number; store?: number }>): string {
  const indices: Record<string, unknown> = {}
  for (const [name, v] of Object.entries(entries)) {
    indices[name] = {
      primaries: {
        bulk: { total_size_in_bytes: v.bulk ?? 0 },
        store: { size_in_bytes: v.store ?? 0 },
      },
    }
  }
  return JSON.stringify({ indices })
}

function settings(entries: Record<string, number>): string {
  const out: Record<string, unknown> = {}
  for (const [name, creationDate] of Object.entries(entries)) {
    out[name] = { settings: { index: { creation_date: String(creationDate) } } }
  }
  return JSON.stringify(out)
}

function ilmExplain(entries: Record<string, { action?: string; lifecycle_date_millis?: number; managed?: boolean }>): string {
  const indices: Record<string, unknown> = {}
  for (const [name, v] of Object.entries(entries)) {
    indices[name] = v
  }
  return JSON.stringify({ indices })
}

function dataStreams(streams: Array<{ writeIndex: string; otherIndices?: string[] }>): string {
  const data_streams = streams.map(s => ({
    indices: [
      ...(s.otherIndices ?? []).map(n => ({ index_name: n })),
      { index_name: s.writeIndex },
    ],
  }))
  return JSON.stringify({ data_streams })
}

function aliasJson(entries: Record<string, { aliasName: string; isWriteIndex: boolean }>): string {
  const out: Record<string, unknown> = {}
  for (const [indexName, v] of Object.entries(entries)) {
    out[indexName] = { aliases: { [v.aliasName]: { is_write_index: v.isWriteIndex } } }
  }
  return JSON.stringify(out)
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers for the doc's verification fixture:
// "already rolled over" branch: age_ms > since_rollover_ms
// write_phase_sec = (lifecycle_date_ms - creation_date_ms) / 1000
// ────────────────────────────────────────────────────────────────────────────
function makeAlreadyRolledFiles(opts: {
  indexName: string
  bulk: number
  store: number
  writePhaseSec: number   // = (lifecycle_date_ms - creation_date_ms) / 1000
}): Map<string, string> {
  // Make creation → lifecycle span exactly writePhaseSec
  const creationDateMs = T_COLLECTION - 500_000          // 500s before collection
  const lifecycleDateMs = creationDateMs + opts.writePhaseSec * 1000
  // sinceRolloverMs = T_COLLECTION - lifecycleDateMs = 500_000 - writePhaseSec*1000
  // ageMs = 500_000 — always > sinceRolloverMs when writePhaseSec > 0

  return new Map([
    ['diagnostic_manifest.json', manifest()],
    ['indices_stats.json', indicesStats({ [opts.indexName]: { bulk: opts.bulk, store: opts.store } })],
    ['settings.json', settings({ [opts.indexName]: creationDateMs })],
    ['commercial/ilm_explain.json', ilmExplain({ [opts.indexName]: { action: 'complete', lifecycle_date_millis: lifecycleDateMs, managed: true } })],
    ['commercial/data_stream.json', dataStreams([{ writeIndex: opts.indexName }])],
    ['alias.json', JSON.stringify({})],
  ])
}

// "still writing" branch: action === 'rollover', lifecycle_date_millis === creation_date_ms
// write_phase_sec = ageMs / 1000
function makeStillWritingFiles(opts: {
  indexName: string
  bulk: number
  store: number
  writePhaseSec: number   // = age_ms / 1000
}): Map<string, string> {
  const creationDateMs = T_COLLECTION - opts.writePhaseSec * 1000
  const lifecycleDateMs = creationDateMs  // lifecycle_date_millis == creation: sinceRolloverMs == ageMs

  return new Map([
    ['diagnostic_manifest.json', manifest()],
    ['indices_stats.json', indicesStats({ [opts.indexName]: { bulk: opts.bulk, store: opts.store } })],
    ['settings.json', settings({ [opts.indexName]: creationDateMs })],
    ['commercial/ilm_explain.json', ilmExplain({ [opts.indexName]: { action: 'rollover', lifecycle_date_millis: lifecycleDateMs, managed: true } })],
    ['commercial/data_stream.json', dataStreams([{ writeIndex: opts.indexName }])],
    ['alias.json', JSON.stringify({})],
  ])
}

// ────────────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────────────

describe('parseBulkIngestRate — doc verification fixtures', () => {
  it('already-rolled-over branch: indexingBytesPerDay matches esdiag fixture (write_phase_sec=79, store=227→248263)', () => {
    const files = makeAlreadyRolledFiles({ indexName: 'idx-a', bulk: 0, store: 227, writePhaseSec: 79 })
    const result = parseBulkIngestRate(files)
    expect(result?.indexingBytesPerDay).toBe(248_263)
  })

  it('still-writing branch: bulkBytesPerDay matches esdiag fixture (write_phase_sec=104, bulk=1759→1461323)', () => {
    const files = makeStillWritingFiles({ indexName: 'idx-b', bulk: 1759, store: 0, writePhaseSec: 104 })
    const result = parseBulkIngestRate(files)
    expect(result?.bulkBytesPerDay).toBe(1_461_323)
  })
})

describe('parseBulkIngestRate — write-phase branches', () => {
  it('already-rolled-over branch: uses creation→rollover window, not creation→now', () => {
    // write_phase_sec = 200s; index age from collection is 500s
    const files = makeAlreadyRolledFiles({ indexName: 'idx', bulk: 86_400, store: 0, writePhaseSec: 200 })
    const result = parseBulkIngestRate(files)
    // Expected: trunc(86400 * 86400 / 200) = trunc(37324800) = 37_324_800
    expect(result?.bulkBytesPerDay).toBe(Math.trunc(86_400 * 86_400 / 200))
  })

  it('still-writing branch (action===rollover): uses full index age as window', () => {
    const files = makeStillWritingFiles({ indexName: 'idx', bulk: 0, store: 86_400, writePhaseSec: 300 })
    const result = parseBulkIngestRate(files)
    expect(result?.indexingBytesPerDay).toBe(Math.trunc(86_400 * 86_400 / 300))
  })
})

describe('parseBulkIngestRate — missing and excluded ILM data', () => {
  it('missing lifecycle_date_millis on a managed index contributes 0 (EQ Bank pattern)', () => {
    // Index is managed:true but lifecycle_date_millis absent → writePhaseSec = 0 → excluded
    const files = new Map([
      ['diagnostic_manifest.json', manifest()],
      ['indices_stats.json', indicesStats({ 'idx': { bulk: 1_000_000, store: 100_000 } })],
      ['settings.json', settings({ 'idx': T_COLLECTION - 1_000_000 })],
      ['commercial/ilm_explain.json', ilmExplain({ 'idx': { managed: true, action: 'rollover' } })],
      ['commercial/data_stream.json', dataStreams([{ writeIndex: 'idx' }])],
      ['alias.json', JSON.stringify({})],
    ])
    const result = parseBulkIngestRate(files)
    expect(result?.bulkBytesPerDay).toBe(0)
    expect(result?.writeIndexCount).toBe(0)
  })

  it('unmanaged two-key stub {managed:false} contributes 0 and does not throw', () => {
    const files = new Map([
      ['diagnostic_manifest.json', manifest()],
      ['indices_stats.json', indicesStats({ 'idx': { bulk: 5_000, store: 1_000 } })],
      ['settings.json', settings({ 'idx': T_COLLECTION - 50_000 })],
      ['commercial/ilm_explain.json', JSON.stringify({ indices: { 'idx': { managed: false } } })],
      ['commercial/data_stream.json', dataStreams([{ writeIndex: 'idx' }])],
      ['alias.json', JSON.stringify({})],
    ])
    expect(() => parseBulkIngestRate(files)).not.toThrow()
    const result = parseBulkIngestRate(files)
    expect(result?.bulkBytesPerDay).toBe(0)
    expect(result?.writeIndexCount).toBe(0)
  })

  it('ambiguous action ("complete" with age_ms <= since_rollover_ms) contributes 0', () => {
    // ageMs <= sinceRolloverMs and action != 'rollover' → writePhaseSec = 0
    const creationDateMs = T_COLLECTION - 100_000
    // lifecycle_date_millis set to far in the past so sinceRolloverMs > ageMs
    const lifecycleDateMs = T_COLLECTION - 200_000
    const files = new Map([
      ['diagnostic_manifest.json', manifest()],
      ['indices_stats.json', indicesStats({ 'idx': { bulk: 9_000, store: 900 } })],
      ['settings.json', settings({ 'idx': creationDateMs })],
      ['commercial/ilm_explain.json', ilmExplain({ 'idx': { action: 'complete', lifecycle_date_millis: lifecycleDateMs, managed: true } })],
      ['commercial/data_stream.json', dataStreams([{ writeIndex: 'idx' }])],
      ['alias.json', JSON.stringify({})],
    ])
    const result = parseBulkIngestRate(files)
    expect(result?.bulkBytesPerDay).toBe(0)
    expect(result?.writeIndexCount).toBe(0)
  })
})

describe('parseBulkIngestRate — write-index filtering', () => {
  it('non-write index is excluded even when it has a valid bounded window', () => {
    // 'current-write' is the write index; 'old-backing' is a rolled-over non-write index
    const files = new Map([
      ['diagnostic_manifest.json', manifest()],
      ['indices_stats.json', indicesStats({
        'old-backing': { bulk: 1_000_000_000, store: 100_000_000 },
        'current-write': { bulk: 50_000, store: 5_000 },
      })],
      ['settings.json', settings({
        'old-backing': T_COLLECTION - 500_000,
        'current-write': T_COLLECTION - 86_400_000,
      })],
      ['commercial/ilm_explain.json', ilmExplain({
        'old-backing': { action: 'complete', lifecycle_date_millis: T_COLLECTION - 100_000, managed: true },
        'current-write': { action: 'rollover', lifecycle_date_millis: T_COLLECTION - 86_400_000, managed: true },
      })],
      ['commercial/data_stream.json', dataStreams([{ writeIndex: 'current-write', otherIndices: ['old-backing'] }])],
      ['alias.json', JSON.stringify({})],
    ])
    const result = parseBulkIngestRate(files)
    // Only current-write should be summed; old-backing's giant numbers must be absent
    expect(result?.writeIndexCount).toBe(1)
    // current-write: writePhaseSec = ageMs / 1000 = 86400s → rate = 50000 * 86400 / 86400 = 50000
    expect(result?.bulkBytesPerDay).toBe(50_000)
  })

  it('write index identified via alias.json is_write_index:true (not data stream)', () => {
    const files = new Map([
      ['diagnostic_manifest.json', manifest()],
      ['indices_stats.json', indicesStats({ 'alias-write-idx': { bulk: 86_400, store: 8_640 } })],
      ['settings.json', settings({ 'alias-write-idx': T_COLLECTION - 86_400_000 })],
      ['commercial/ilm_explain.json', ilmExplain({ 'alias-write-idx': { action: 'rollover', lifecycle_date_millis: T_COLLECTION - 86_400_000, managed: true } })],
      ['commercial/data_stream.json', JSON.stringify({ data_streams: [] })],
      ['alias.json', aliasJson({ 'alias-write-idx': { aliasName: 'logs-alias', isWriteIndex: true } })],
    ])
    const result = parseBulkIngestRate(files)
    expect(result?.writeIndexCount).toBe(1)
    expect(result?.bulkBytesPerDay).toBe(86_400)  // 86400 * 86400 / 86400 = 86400
  })
})

describe('parseBulkIngestRate — edge cases', () => {
  it('creation_date as a string is handled correctly', () => {
    // settings.json stores creation_date as a string — this is the real bundle format
    const files = makeAlreadyRolledFiles({ indexName: 'idx', bulk: 86_400, store: 0, writePhaseSec: 86_400 })
    // Verify creation_date is stringified in settings fixture
    const settingsRaw = JSON.parse(files.get('settings.json') ?? '{}')
    expect(typeof settingsRaw['idx'].settings.index.creation_date).toBe('string')
    const result = parseBulkIngestRate(files)
    expect(result?.bulkBytesPerDay).toBe(86_400)
  })

  it('negative age (index created after T_collection) clamps to 0 → rate is 0', () => {
    // creation_date is in the future relative to T_collection
    const creationDateMs = T_COLLECTION + 100_000
    const files = new Map([
      ['diagnostic_manifest.json', manifest()],
      ['indices_stats.json', indicesStats({ 'idx': { bulk: 99_999, store: 9_999 } })],
      ['settings.json', settings({ 'idx': creationDateMs })],
      ['commercial/ilm_explain.json', ilmExplain({ 'idx': { action: 'rollover', lifecycle_date_millis: creationDateMs, managed: true } })],
      ['commercial/data_stream.json', dataStreams([{ writeIndex: 'idx' }])],
      ['alias.json', JSON.stringify({})],
    ])
    const result = parseBulkIngestRate(files)
    // ageMs = max(0, T_COLLECTION - creationDateMs) = 0 → writePhaseSec = 0 → excluded
    expect(result?.bulkBytesPerDay).toBe(0)
    expect(result?.writeIndexCount).toBe(0)
  })

  it('missing indices_stats.json → returns null, does not throw', () => {
    const files = new Map([
      ['diagnostic_manifest.json', manifest()],
      ['settings.json', settings({ 'idx': T_COLLECTION - 1000 })],
      ['commercial/ilm_explain.json', ilmExplain({ 'idx': { action: 'rollover', lifecycle_date_millis: T_COLLECTION - 1000, managed: true } })],
      ['commercial/data_stream.json', dataStreams([{ writeIndex: 'idx' }])],
      ['alias.json', JSON.stringify({})],
    ])
    expect(() => parseBulkIngestRate(files)).not.toThrow()
    expect(parseBulkIngestRate(files)).toBeNull()
  })

  it('missing manifest (no collection timestamp) → returns null, does not throw', () => {
    const files = new Map([
      ['indices_stats.json', indicesStats({ 'idx': { bulk: 1000, store: 100 } })],
      ['settings.json', settings({ 'idx': 0 })],
      ['commercial/data_stream.json', dataStreams([{ writeIndex: 'idx' }])],
      ['alias.json', JSON.stringify({})],
    ])
    expect(() => parseBulkIngestRate(files)).not.toThrow()
    expect(parseBulkIngestRate(files)).toBeNull()
  })

  it('compressionRatio is null when indexingBytesPerDay is 0 (no divide-by-zero)', () => {
    // store = 0 for all write indices → indexingBytesPerDay = 0
    const files = makeAlreadyRolledFiles({ indexName: 'idx', bulk: 999, store: 0, writePhaseSec: 100 })
    const result = parseBulkIngestRate(files)
    expect(result?.indexingBytesPerDay).toBe(0)
    expect(result?.compressionRatio).toBeNull()
  })

  it('no write indices found → returns null', () => {
    const files = new Map([
      ['diagnostic_manifest.json', manifest()],
      ['indices_stats.json', indicesStats({ 'idx': { bulk: 1000, store: 100 } })],
      ['settings.json', settings({ 'idx': T_COLLECTION - 1000 })],
      ['commercial/data_stream.json', JSON.stringify({ data_streams: [] })],
      ['alias.json', JSON.stringify({})],
    ])
    expect(parseBulkIngestRate(files)).toBeNull()
  })
})
