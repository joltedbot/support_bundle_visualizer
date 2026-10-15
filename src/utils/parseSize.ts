const UNITS: ReadonlyArray<readonly [string, number]> = [
  // Longest suffixes first so "gb" matches before "b"
  ['tb', 1024 ** 4],
  ['gb', 1024 ** 3],
  ['mb', 1024 ** 2],
  ['kb', 1024],
  ['b', 1],
]

/**
 * Convert a human-readable cat-API size string ("50mb", "1.2gb", "-") to bytes.
 * Handles b, kb, mb, gb, tb (case-insensitive); a bare number is taken as bytes.
 * Returns 0 for missing or unparseable input — never throws.
 */
export function parseSize(sizeStr: string): number {
  if (!sizeStr || sizeStr === '-') return 0
  const lower = sizeStr.toLowerCase().trim()
  for (const [suffix, multiplier] of UNITS) {
    if (lower.endsWith(suffix)) {
      const num = parseFloat(lower.slice(0, -suffix.length))
      return isNaN(num) ? 0 : Math.round(num * multiplier)
    }
  }
  const num = parseFloat(lower)
  return isNaN(num) ? 0 : Math.round(num)
}
