import { parseJsonFile } from '../utils/bundleReader'
import type { PluginEntry } from './types'

interface PluginRecord {
  name?: string
  component?: string
  version?: string
}

export function parsePlugins(files: Map<string, string>): PluginEntry[] {
  const json = parseJsonFile<PluginRecord[]>(files, 'plugins.json')
  if (!Array.isArray(json)) return []

  const seen = new Map<string, string>()
  for (const p of json) {
    const component = p.component
    if (!component) continue
    if (!seen.has(component)) {
      seen.set(component, p.version ?? '')
    }
  }

  return Array.from(seen.entries()).map(([component, version]) => ({ component, version }))
}
