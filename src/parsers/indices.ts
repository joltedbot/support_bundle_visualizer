import { getTextFile } from '../utils/bundleReader'
import { parseSize } from '../utils/parseSize'
import type { IndexInfo } from './types'

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
export function parseIndices(files: Map<string, string>, aliasBackedIndices: Set<string>): IndexInfo[] {
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
  const priStoreSizeIdx = col('pri.store.size')

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
    const priStoreSizeBytes = priStoreSizeIdx !== -1 ? parseSize(parts[priStoreSizeIdx] ?? '') : 0

    const avgShardSizeBytes = primaryShards > 0 ? Math.round(priStoreSizeBytes / primaryShards) : 0

    let indexType: IndexInfo['indexType']
    if (name.startsWith('.ds-')) {
      indexType = 'datastream-backing'
    } else if (aliasBackedIndices.has(name)) {
      indexType = 'alias-backing'
    } else {
      indexType = 'index'
    }

    result.push({
      name,
      isSystem: name.startsWith('.'),
      health,
      status,
      primaryShards,
      replicaShards,
      docCount,
      storeSizeBytes,
      avgShardSizeBytes,
      indexType,
    })
  }

  return result
}
