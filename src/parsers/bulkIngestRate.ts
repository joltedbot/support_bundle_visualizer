import { parseJsonFile } from '../utils/bundleReader'
import type { IlmWindowRates } from './types'

const SECONDS_PER_DAY = 86_400

interface DiagManifest {
  collection_date_millis?: number
  timestamp?: string
}

interface ManifestJson {
  collectionDate?: string
}

interface IndexStats {
  primaries?: {
    bulk?: { total_size_in_bytes?: number }
    store?: { size_in_bytes?: number }
  }
}

interface IndicesStatsJson {
  indices?: Record<string, IndexStats>
}

interface SettingsIndexEntry {
  settings?: {
    index?: {
      creation_date?: string | number
    }
  }
}

interface IlmExplainEntry {
  action?: string
  lifecycle_date_millis?: number
}

interface IlmExplainJson {
  indices?: Record<string, IlmExplainEntry>
}

interface DataStreamIndex {
  index_name?: string
}

interface DataStreamEntry {
  indices?: DataStreamIndex[]
}

interface DataStreamsJson {
  data_streams?: DataStreamEntry[]
}

interface AliasIndexEntry {
  aliases?: Record<string, { is_write_index?: boolean }>
}

function resolveCollectionTimestamp(files: Map<string, string>): number | null {
  const diagManifest = parseJsonFile<DiagManifest>(files, 'diagnostic_manifest.json')
  if (diagManifest) {
    if (typeof diagManifest.collection_date_millis === 'number' && diagManifest.collection_date_millis > 0) {
      return diagManifest.collection_date_millis
    }
    if (diagManifest.timestamp) {
      const ts = Date.parse(diagManifest.timestamp)
      if (isFinite(ts)) return ts
    }
  }

  const manifest = parseJsonFile<ManifestJson>(files, 'manifest.json')
  if (manifest?.collectionDate) {
    const ts = Date.parse(manifest.collectionDate)
    if (isFinite(ts)) return ts
  }

  return null
}

function buildWriteIndexSet(files: Map<string, string>): Set<string> {
  const writeIndices = new Set<string>()

  // Data stream backing indices: last entry per stream is the write target
  const dataStreamsRaw = parseJsonFile<DataStreamsJson>(files, 'commercial/data_stream.json')
  if (Array.isArray(dataStreamsRaw?.data_streams)) {
    for (const stream of dataStreamsRaw.data_streams) {
      const indices = stream.indices
      if (Array.isArray(indices) && indices.length > 0) {
        const last = indices[indices.length - 1]
        if (last?.index_name) writeIndices.add(last.index_name)
      }
    }
  }

  // Rollover alias write targets: is_write_index === true at the alias level
  const aliasRaw = parseJsonFile<Record<string, AliasIndexEntry>>(files, 'alias.json')
  if (aliasRaw) {
    for (const [indexName, entry] of Object.entries(aliasRaw)) {
      if (entry?.aliases) {
        for (const aliasEntry of Object.values(entry.aliases)) {
          if (aliasEntry?.is_write_index === true) {
            writeIndices.add(indexName)
            break
          }
        }
      }
    }
  }

  return writeIndices
}

/**
 * Derive per-cluster bulk ingest and on-disk growth rates using the esdiag ILM-window method.
 *
 * For each write index, the write window is bounded by the index's ILM lifecycle:
 *   - Already rolled over: creation → rollover transition (lifecycle_date_millis)
 *   - Still the write target (action === "rollover"): creation → T_collection
 * Rate = cumulative bytes ÷ write_phase_sec × 86400.
 *
 * Returns null when the manifest or indices_stats.json is absent, or when no write
 * indices can be identified (no data streams, no rollover aliases).
 */
export function parseBulkIngestRate(files: Map<string, string>): IlmWindowRates | null {
  const tCollection = resolveCollectionTimestamp(files)
  if (tCollection === null) return null

  const indicesStatsRaw = parseJsonFile<IndicesStatsJson>(files, 'indices_stats.json')
  if (!indicesStatsRaw?.indices) return null

  const settingsRaw = parseJsonFile<Record<string, SettingsIndexEntry>>(files, 'settings.json')

  const ilmExplainRaw = parseJsonFile<IlmExplainJson>(files, 'commercial/ilm_explain.json')
  // Some bundles emit indices at the top level rather than nested under .indices
  const ilmEntries: Record<string, IlmExplainEntry> =
    ilmExplainRaw?.indices ?? (ilmExplainRaw as Record<string, IlmExplainEntry> | null) ?? {}

  const writeIndices = buildWriteIndexSet(files)
  if (writeIndices.size === 0) return null

  let totalBulkBytesPerDay = 0
  let totalIndexingBytesPerDay = 0
  let writeIndexCount = 0

  for (const [indexName, indexStats] of Object.entries(indicesStatsRaw.indices)) {
    if (!writeIndices.has(indexName)) continue

    const bulkTotalBytes = indexStats?.primaries?.bulk?.total_size_in_bytes ?? 0
    const storeSizeBytes = indexStats?.primaries?.store?.size_in_bytes ?? 0

    const creationDateRaw = settingsRaw?.[indexName]?.settings?.index?.creation_date
    const creationDateMs = creationDateRaw !== undefined ? Number(creationDateRaw) : NaN
    // Clamp negative age: index created after collection timestamp is meaningless
    const ageMs = isFinite(creationDateMs) ? Math.max(0, tCollection - creationDateMs) : 0

    const ilmEntry = ilmEntries[indexName]
    const lifecycleDateMs = typeof ilmEntry?.lifecycle_date_millis === 'number'
      ? ilmEntry.lifecycle_date_millis
      : undefined
    const ilmAction = ilmEntry?.action

    let writePhaseSec: number
    if (ageMs === 0 || lifecycleDateMs === undefined) {
      // No usable write window: index has no age (created after collection), or no ILM data
      writePhaseSec = 0
    } else {
      const sinceRolloverMs = tCollection - lifecycleDateMs
      if (ageMs > sinceRolloverMs) {
        // Already rolled over: window = creation → rollover transition
        writePhaseSec = (ageMs - sinceRolloverMs) / 1000
      } else if (ilmAction === 'rollover') {
        // Still the active write target: window = creation → now
        writePhaseSec = ageMs / 1000
      } else {
        // Ambiguous state (e.g. "complete" but not yet past rollover) — excluded
        writePhaseSec = 0
      }
    }

    if (writePhaseSec === 0) continue

    // Use Math.trunc (not round) to match the esdiag int() cast
    totalBulkBytesPerDay += Math.trunc(bulkTotalBytes * SECONDS_PER_DAY / writePhaseSec)
    totalIndexingBytesPerDay += Math.trunc(storeSizeBytes * SECONDS_PER_DAY / writePhaseSec)
    writeIndexCount++
  }

  return {
    bulkBytesPerDay: totalBulkBytesPerDay,
    indexingBytesPerDay: totalIndexingBytesPerDay,
    compressionRatio: totalIndexingBytesPerDay > 0 ? totalBulkBytesPerDay / totalIndexingBytesPerDay : null,
    writeIndexCount,
  }
}
