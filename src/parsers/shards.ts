import { getTextFile } from '../utils/bundleReader'
import type { ShardInfo } from './types'

const OVERSIZED_BYTES = 50 * 1024 * 1024 * 1024   // 50 GB
const UNDERSIZED_BYTES = 1 * 1024 * 1024 * 1024    // 1 GB

/**
 * Convert size string to bytes.
 * Handles: b, kb, mb, gb, tb (case-insensitive).
 */
function parseSize(sizeStr: string): number {
  if (!sizeStr || sizeStr === '-' || sizeStr === '') return 0
  const lower = sizeStr.toLowerCase().trim()
  const units: Record<string, number> = {
    tb: 1024 * 1024 * 1024 * 1024,
    gb: 1024 * 1024 * 1024,
    mb: 1024 * 1024,
    kb: 1024,
    b: 1,
  }
  for (const [suffix, multiplier] of Object.entries(units)) {
    if (lower.endsWith(suffix)) {
      const num = parseFloat(lower.slice(0, -suffix.length))
      return isNaN(num) ? 0 : Math.round(num * multiplier)
    }
  }
  const num = parseFloat(lower)
  return isNaN(num) ? 0 : Math.round(num)
}

/**
 * Parse cat/cat_shards.txt → ShardInfo[].
 * Columns: index shard prirep state docs store dataset ip node
 */
export function parseShards(files: Map<string, string>): ShardInfo[] {
  const content = getTextFile(files, 'cat/cat_shards.txt')
  if (!content) return []

  const lines = content.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  const header = lines[0].trim().split(/\s+/)
  const col = (name: string) => header.indexOf(name)

  const indexIdx = col('index')
  const shardIdx = col('shard')
  const prirepIdx = col('prirep')
  const stateIdx = col('state')
  const storeIdx = col('store')
  const nodeIdx = col('node')

  if (indexIdx === -1 || shardIdx === -1) return []

  const result: ShardInfo[] = []

  for (const line of lines.slice(1)) {
    const parts = line.trim().split(/\s+/)
    if (parts.length <= indexIdx) continue

    const index = parts[indexIdx] ?? ''
    if (!index) continue

    const shardNum = parseInt(parts[shardIdx] ?? '0', 10)
    const prirepRaw = parts[prirepIdx] ?? 'p'
    const prirep: ShardInfo['prirep'] = prirepRaw === 'r' ? 'r' : 'p'
    const state = stateIdx !== -1 ? (parts[stateIdx] ?? 'UNKNOWN') : 'UNKNOWN'
    const node = nodeIdx !== -1 ? parts[nodeIdx] : undefined
    const storeSizeBytes = storeIdx !== -1 ? parseSize(parts[storeIdx] ?? '') : 0

    result.push({
      index,
      shard: isNaN(shardNum) ? 0 : shardNum,
      prirep,
      state,
      node,
      storeSizeBytes,
      oversized: storeSizeBytes > OVERSIZED_BYTES,
      undersized: storeSizeBytes > 0 && storeSizeBytes < UNDERSIZED_BYTES,
    })
  }

  return result
}
