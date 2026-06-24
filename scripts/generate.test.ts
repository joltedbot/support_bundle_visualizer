import { describe, it, expect, afterEach } from 'vitest'
import { mkdirSync, rmSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { detectDeploymentMode } from './detectDeploymentMode'

// Track temp dirs for cleanup
const tempDirs: string[] = []

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'generate-test-'))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    try { rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
  }
})

describe('detectDeploymentMode', () => {
  it('single: directory contains api-diagnostics-* directly → single', () => {
    const root = makeTempDir()
    mkdirSync(join(root, 'api-diagnostics-20240101'))
    const result = detectDeploymentMode(root)
    expect(result.kind).toBe('single')
  })

  it('single: directory contains local-diagnostics-* directly → single', () => {
    const root = makeTempDir()
    mkdirSync(join(root, 'local-diagnostics-20240101'))
    const result = detectDeploymentMode(root)
    expect(result.kind).toBe('single')
  })

  it('multi: subdirectories each contain api-diagnostics-* → multi', () => {
    const root = makeTempDir()
    mkdirSync(join(root, 'prod', 'api-diagnostics-20240101'), { recursive: true })
    mkdirSync(join(root, 'staging', 'api-diagnostics-20240102'), { recursive: true })
    const result = detectDeploymentMode(root)
    expect(result.kind).toBe('multi')
    if (result.kind === 'multi') {
      expect(result.deployments).toContain('prod')
      expect(result.deployments).toContain('staging')
      expect(result.deployments).toHaveLength(2)
    }
  })

  it('multi: deployments are sorted alphabetically', () => {
    const root = makeTempDir()
    mkdirSync(join(root, 'z-cluster', 'api-diagnostics-20240101'), { recursive: true })
    mkdirSync(join(root, 'a-cluster', 'api-diagnostics-20240101'), { recursive: true })
    mkdirSync(join(root, 'm-cluster', 'api-diagnostics-20240101'), { recursive: true })
    const result = detectDeploymentMode(root)
    if (result.kind === 'multi') {
      expect(result.deployments).toEqual(['a-cluster', 'm-cluster', 'z-cluster'])
    }
  })

  it('multi: mixed local- and api- diagnostic folders across subdirs → multi', () => {
    const root = makeTempDir()
    mkdirSync(join(root, 'dep1', 'api-diagnostics-20240101'), { recursive: true })
    mkdirSync(join(root, 'dep2', 'local-diagnostics-20240101'), { recursive: true })
    const result = detectDeploymentMode(root)
    expect(result.kind).toBe('multi')
  })

  it('ambiguous: empty directory → ambiguous', () => {
    const root = makeTempDir()
    const result = detectDeploymentMode(root)
    expect(result.kind).toBe('ambiguous')
  })

  it('ambiguous: directory with non-bundle subdirectories → ambiguous', () => {
    const root = makeTempDir()
    mkdirSync(join(root, 'some-other-folder'))
    mkdirSync(join(root, 'another-folder'))
    const result = detectDeploymentMode(root)
    expect(result.kind).toBe('ambiguous')
  })

  it('ambiguous: subdirs present but none contain bundle folders → ambiguous', () => {
    const root = makeTempDir()
    // Subdirs exist but have no api-diagnostics-* inside
    mkdirSync(join(root, 'dep1', 'random-folder'), { recursive: true })
    mkdirSync(join(root, 'dep2', 'another-folder'), { recursive: true })
    const result = detectDeploymentMode(root)
    expect(result.kind).toBe('ambiguous')
  })

  it('single takes precedence when api-diagnostics-* is at top level even with subdirs', () => {
    const root = makeTempDir()
    mkdirSync(join(root, 'api-diagnostics-20240101'))
    mkdirSync(join(root, 'some-subdir', 'api-diagnostics-20240101'), { recursive: true })
    const result = detectDeploymentMode(root)
    // Top-level bundle → single
    expect(result.kind).toBe('single')
  })
})
