/**
 * Convert a human-readable ES size string to bytes.
 * Handles: b, kb, mb, gb, tb (case-insensitive).
 * Uses an ordered array so longer suffixes match before shorter ones (e.g. "gb" before "b").
 */
export function parseSize(sizeStr: string): number {
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
