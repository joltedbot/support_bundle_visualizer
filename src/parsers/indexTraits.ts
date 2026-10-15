import { parseJsonFile } from '../utils/bundleReader'
import type { VectorTraits } from './types'
import { walkMappingFields } from './mappingScan'
import type { MappingField } from './mappingScan'

type MappingIndex = {
  mappings?: {
    _source?: { mode?: string }
    properties?: Record<string, MappingField>
  }
}

type SettingsIndex = {
  settings?: { index?: { mode?: string; mapping?: { source?: { mode?: string } } } }
}

export interface IndexTraits {
  indexMode: string | null     // verbatim index.mode; 'standard' when the settings entry has none; null without a settings entry
  syntheticSource: boolean
  dataStreamType?: string      // data_stream.type constant_keyword value, when mapped
  vector?: VectorTraits        // present only when a dense/sparse/semantic field exists
}

// dense_vector defaults to HNSW when index_options is not set
const DEFAULT_DENSE_TYPE = 'hnsw'

interface VectorScan {
  dense: boolean
  sparse: boolean
  semantic: boolean
  denseTypes: Set<string>
}

function scanVectors(props: Record<string, MappingField>, acc: VectorScan): void {
  walkMappingFields(props, field => {
    if (field.type === 'dense_vector') {
      acc.dense = true
      const optType = field.index_options?.type
      acc.denseTypes.add(typeof optType === 'string' && optType ? optType : DEFAULT_DENSE_TYPE)
    } else if (field.type === 'sparse_vector') {
      acc.sparse = true
    } else if (field.type === 'semantic_text') {
      acc.semantic = true
    }
  })
}

/**
 * Per-index traits from settings.json (index.mode, synthetic _source) and
 * mapping.json (data_stream.type, vector field kinds). Never throws; returns an
 * empty map when neither file is available.
 */
export function parseIndexTraits(files: Map<string, string>): Map<string, IndexTraits> {
  const traits = new Map<string, IndexTraits>()
  const settings = parseJsonFile<Record<string, SettingsIndex>>(files, 'settings.json')
  const mapping = parseJsonFile<Record<string, MappingIndex>>(files, 'mapping.json')

  const get = (name: string): IndexTraits => {
    let t = traits.get(name)
    if (!t) {
      t = { indexMode: null, syntheticSource: false }
      traits.set(name, t)
    }
    return t
  }

  if (settings && typeof settings === 'object') {
    for (const [name, entry] of Object.entries(settings)) {
      const idx = entry?.settings?.index
      const t = get(name)
      t.indexMode = typeof idx?.mode === 'string' && idx.mode ? idx.mode : 'standard'
      if (idx?.mapping?.source?.mode === 'synthetic') t.syntheticSource = true
    }
  }

  if (mapping && typeof mapping === 'object') {
    for (const [name, entry] of Object.entries(mapping)) {
      const m = entry?.mappings
      if (!m || typeof m !== 'object') continue
      const t = get(name)
      if (m._source?.mode === 'synthetic') t.syntheticSource = true

      const props = m.properties
      if (!props || typeof props !== 'object') continue

      const dsType = props.data_stream?.properties?.type?.value
      if (typeof dsType === 'string' && dsType) t.dataStreamType = dsType

      const acc: VectorScan = { dense: false, sparse: false, semantic: false, denseTypes: new Set() }
      scanVectors(props, acc)
      if (acc.dense || acc.sparse || acc.semantic) {
        t.vector = {
          dense: acc.dense,
          sparse: acc.sparse,
          semantic: acc.semantic,
          denseTypes: Array.from(acc.denseTypes).sort(),
        }
      }
    }
  }

  return traits
}
