import { DISK_HIGH, DISK_ALLOC_BLOCKED, DISK_SHARD_MOVE, DISK_FLOOD } from './thresholds'

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

export function formatWaitTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  if (totalSeconds < 1) return '< 1s'
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes < 60) return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}h ${mins}m`
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
  return resourceColor(pct, DISK_HIGH, DISK_ALLOC_BLOCKED)
}

// Returns a label for disk watermark bands above the shard-move threshold; null below that.
export function diskUsageLabel(pct: number): string | null {
  if (pct >= DISK_FLOOD) return 'Flood-stage'
  if (pct >= DISK_SHARD_MOVE) return 'Shard move'
  return null
}
