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

export function formatUptime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
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

export function diskUsageColor(pct: number): 'success' | 'warning' | 'danger' {
  if (pct >= 85) return 'danger'
  if (pct >= 70) return 'warning'
  return 'success'
}

// Returns a label for disk watermark bands above 90%; null below that.
export function diskUsageLabel(pct: number): string | null {
  if (pct >= 95) return 'Flood-stage'
  if (pct >= 90) return 'Shard move'
  return null
}

// Display strings for absent fields — use these instead of ad-hoc "N/A" or "—"
export const UNAVAILABLE = {
  notAvailable: 'Not available',   // data was expected but is absent (file missing, field not emitted)
  notApplicable: 'Not applicable', // metric does not apply to this node/index type
  notComputed: 'Not computed',     // inputs present but computation guard triggered (e.g. uptime = 0)
} as const
