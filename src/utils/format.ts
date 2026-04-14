export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const clamped = Math.min(i, units.length - 1)
  const val = bytes / Math.pow(1024, clamped)
  return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[clamped]}`
}

export function formatCount(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function healthColor(
  status: string
): 'success' | 'warning' | 'danger' | 'default' {
  if (status === 'green') return 'success'
  if (status === 'yellow') return 'warning'
  if (status === 'red') return 'danger'
  return 'default'
}

export function resourceColor(
  percent: number,
  warn: number,
  crit: number
): 'success' | 'warning' | 'danger' {
  if (percent >= crit) return 'danger'
  if (percent >= warn) return 'warning'
  return 'success'
}
