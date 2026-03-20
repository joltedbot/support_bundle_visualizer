import { getTextFile } from '../utils/bundleReader'
import type { IndexInfo } from './types'

/**
 * Convert a human-readable size string to bytes.
 * Handles: b, kb, mb, gb, tb (case-insensitive).
 */
function parseSize(sizeStr: string): number {
  if (!sizeStr || sizeStr === '-' || sizeStr === '') return 0
  const lower = sizeStr.toLowerCase().trim()
  // Longest suffixes must be checked first so "gb" matches before "b", etc.
  const units: [string, number][] = [
    ['tb', 1024 * 1024 * 1024 * 1024],
    ['gb', 1024 * 1024 * 1024],
    ['mb', 1024 * 1024],
    ['kb', 1024],
    ['b', 1],
  ]
  for (const [suffix, multiplier] of units) {
    if (lower.endsWith(suffix)) {
      const num = parseFloat(lower.slice(0, -suffix.length))
      return isNaN(num) ? 0 : Math.round(num * multiplier)
    }
  }
  // Bare number — assume bytes
  const num = parseFloat(lower)
  return isNaN(num) ? 0 : Math.round(num)
}

function normalizeHealth(h: string): IndexInfo['health'] {
  if (h === 'green') return 'green'
  if (h === 'yellow') return 'yellow'
  if (h === 'red') return 'red'
  return 'unknown'
}

/**
 * Parse cat/cat_indices.txt → IndexInfo[].
 * Columns: health status index uuid pri rep docs.count docs.deleted store.size pri.store.size
 */
export function parseIndices(files: Map<string, string>): IndexInfo[] {
  const content = getTextFile(files, 'cat/cat_indices.txt')
  if (!content) return []

  const lines = content.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  // Parse header to determine column indices
  const header = lines[0].trim().split(/\s+/)
  const col = (name: string) => header.indexOf(name)

  const healthIdx = col('health')
  const statusIdx = col('status')
  const indexIdx = col('index')
  const priIdx = col('pri')
  const repIdx = col('rep')
  const docsCountIdx = col('docs.count')
  const storeSizeIdx = col('store.size')

  // Require at minimum health, status, index columns
  if (healthIdx === -1 || statusIdx === -1 || indexIdx === -1) return []

  const result: IndexInfo[] = []

  for (const line of lines.slice(1)) {
    const parts = line.trim().split(/\s+/)
    if (parts.length <= indexIdx) continue

    const name = parts[indexIdx] ?? ''
    if (!name) continue

    const health = normalizeHealth(parts[healthIdx] ?? '')
    const statusRaw = parts[statusIdx] ?? 'open'
    const status: IndexInfo['status'] = statusRaw === 'close' ? 'close' : 'open'

    const primaryShards = priIdx !== -1 ? (parseInt(parts[priIdx] ?? '0', 10) || 0) : 0
    const replicaShards = repIdx !== -1 ? (parseInt(parts[repIdx] ?? '0', 10) || 0) : 0
    const docCount = docsCountIdx !== -1 ? (parseInt(parts[docsCountIdx] ?? '0', 10) || 0) : 0
    const storeSizeBytes = storeSizeIdx !== -1 ? parseSize(parts[storeSizeIdx] ?? '') : 0

    result.push({
      name,
      isSystem: name.startsWith('.'),
      health,
      status,
      primaryShards,
      replicaShards,
      docCount,
      storeSizeBytes,
    })
  }

  return result
}
