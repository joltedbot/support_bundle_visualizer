import { describe, it, expect } from 'vitest'
import { formatBytes, formatUptime, resourceColor, diskUsageColor, diskUsageLabel } from './format'

describe('formatBytes', () => {
  it('handles zero and sub-KB values', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1023)).toBe('1023 B')
  })

  it('scales through units', () => {
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1024 ** 3)).toBe('1.0 GB')
    expect(formatBytes(50 * 1024 ** 3)).toBe('50 GB')
  })
})

describe('formatUptime', () => {
  it('formats minutes, hours and days', () => {
    expect(formatUptime(5 * 60_000)).toBe('5m')
    expect(formatUptime(90 * 60_000)).toBe('1h 30m')
    expect(formatUptime(26 * 3_600_000)).toMatch(/^1d/)
  })
})

describe('resourceColor', () => {
  it('uses inclusive warn and crit boundaries', () => {
    expect(resourceColor(49.9, 50, 80)).toBe('success')
    expect(resourceColor(50, 50, 80)).toBe('warning')
    expect(resourceColor(80, 50, 80)).toBe('danger')
  })
})

describe('diskUsageColor / diskUsageLabel boundaries', () => {
  it('colours at the 70 and 85 watermarks', () => {
    expect(diskUsageColor(69)).toBe('success')
    expect(diskUsageColor(70)).toBe('warning')
    expect(diskUsageColor(84)).toBe('warning')
    expect(diskUsageColor(85)).toBe('danger')
  })

  it('labels only the 90 and 95 bands', () => {
    expect(diskUsageLabel(89)).toBeNull()
    expect(diskUsageLabel(90)).toBe('Shard move')
    expect(diskUsageLabel(94)).toBe('Shard move')
    expect(diskUsageLabel(95)).toBe('Flood-stage')
  })
})
