import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

export type DeploymentMode =
  | { kind: 'single' }
  | { kind: 'multi'; deployments: string[] }
  | { kind: 'ambiguous' }

export function detectDeploymentMode(customerPath: string): DeploymentMode {
  const entries = readdirSync(customerPath)
  const isDirAt = (base: string, name: string) => {
    try { return statSync(join(base, name)).isDirectory() } catch { return false }
  }

  const hasBundleAtTopLevel = entries.some(e =>
    (e.startsWith('api-diagnostics-') || e.startsWith('local-diagnostics-')) && isDirAt(customerPath, e)
  )

  if (hasBundleAtTopLevel) {
    return { kind: 'single' }
  }

  const subdirs = entries.filter(e => !e.startsWith('.') && isDirAt(customerPath, e))
  const deployments = subdirs.filter(sub => {
    const subPath = join(customerPath, sub)
    const subEntries = readdirSync(subPath)
    return subEntries.some(e =>
      (e.startsWith('api-diagnostics-') || e.startsWith('local-diagnostics-')) && isDirAt(subPath, e)
    )
  })

  if (deployments.length > 0) {
    return { kind: 'multi', deployments: deployments.sort() }
  }

  return { kind: 'ambiguous' }
}
