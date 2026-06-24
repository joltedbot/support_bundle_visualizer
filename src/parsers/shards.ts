import { getTextFile } from '../utils/bundleReader'
import { parseSize } from '../utils/parseSize'

export interface ShardInfo {
  index: string
  shard: number
  prirep: 'p' | 'r'
  state: string
  node?: string
  storeSizeBytes: number
  oversized: boolean   // > 50GB
  undersized: boolean  // < 1GB (and not empty)
}

const OVERSIZED_BYTES = 50 * 1024 * 1024 * 1024   // 50 GB
const UNDERSIZED_BYTES = 1 * 1024 * 1024 * 1024    // 1 GB

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
      undersized: prirep === 'p' && storeSizeBytes > 0 && storeSizeBytes < UNDERSIZED_BYTES,
    })
  }

  return result
}
