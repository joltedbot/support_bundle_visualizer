import { parseJsonFile } from '../utils/bundleReader'
import type { DataStreamInfo } from './types'

interface DataStreamJson {
  name?: string
  status?: string
  indices?: unknown[]
  ilm_policy?: string
  lifecycle?: { data_retention?: string }
  next_generation_managed_by?: string
}

interface DataStreamsFileJson {
  data_streams?: DataStreamJson[]
}

export function parseDataStreams(files: Map<string, string>): DataStreamInfo[] {
  const json = parseJsonFile<DataStreamsFileJson>(files, 'commercial/data_stream.json')
  if (!Array.isArray(json?.data_streams)) return []

  return json.data_streams
    .filter((d): d is DataStreamJson & { name: string } => typeof d.name === 'string')
    .map(d => {
      const managedBy = d.next_generation_managed_by
      return {
        name: d.name,
        isSystem: d.name.startsWith('.'),
        status: d.status ?? 'unknown',
        indexCount: Array.isArray(d.indices) ? d.indices.length : 0,
        ilmPolicy: d.ilm_policy,
        lifecycle: d.lifecycle?.data_retention,
        managedBy: managedBy && managedBy !== 'Unmanaged' ? managedBy : undefined,
      }
    })
}
