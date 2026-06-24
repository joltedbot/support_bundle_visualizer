/**
 * Convert an ILM min_age string (e.g. "30d", "180d", "6M", "24h") to days.
 * Unit matching is case-sensitive: 'M' = months, 'm' = minutes.
 * Returns null for unparseable or zero/ms values.
 */
export function parseMinAgeDays(minAge: string): number | null {
  if (!minAge) return null
  const trimmed = minAge.trim()
  const lower = trimmed.toLowerCase()
  if (lower === '0ms' || lower === '0s' || lower === '0') return null
  // Match against original trimmed string to preserve 'm' (minutes) vs 'M' (months)
  // eslint-disable-next-line security/detect-unsafe-regex -- anchored pattern; \d+ and (?:\.\d+)? are disjoint, no ReDoS risk
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*([A-Za-z]+)$/)
  if (!match) return null
  const value = parseFloat(match[1])
  const unit = match[2]
  if (isNaN(value) || value <= 0) return null
  switch (unit) {
    case 'd': return value
    case 'h': return value / 24
    case 'm': return value / 1440
    case 'M': return value * 30  // approximate months
    case 'y': return value * 365
    default: return null
  }
}
