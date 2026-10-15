import type { DataAdoption, DataAdoptionKind, DataAdoptionRow, IndexInfo } from './types'
import type { IndexTraits } from './indexTraits'

const ROW_ORDER: DataAdoptionKind[] = ['logs', 'metrics', 'traces', 'security', 'synthetics', 'vector', 'other']

// Elastic Security artifacts only. Vendor/OS log datasets (logs-system.security-*,
// logs-akamai.siem-*) are deliberately absent — calling them Security would be a guess.
const SECURITY_PREFIXES = [
  '.alerts-security.',
  '.internal.alerts-security.',
  '.siem-signals',
  '.lists-',
  '.items-',
  'logs-endpoint.',
  'metrics-endpoint.',
  '.logs-endpoint.',
  'logs-elastic_agent.endpoint_security',
  'logs-elastic_agent.osquerybeat',
  'risk-score.',
  '.entities.v1.',
  '.entity_analytics.',
  'logs-ti_',
  'security_solution-',
]

// Elastic housekeeping that is not dot-prefixed once the .ds- prefix is stripped.
const PLATFORM_PREFIXES = ['ilm-history-', 'elastic-cloud-logs-']

const TYPE_BY_PREFIX: Array<[string, DataAdoptionKind]> = [
  ['logs-', 'logs'],
  ['metrics-', 'metrics'],
  ['traces-', 'traces'],
  ['synthetics-', 'synthetics'],
]

const LEGACY_PREFIXES: Array<[string, DataAdoptionKind]> = [
  ['filebeat-', 'logs'],
  ['winlogbeat-', 'logs'],
  ['auditbeat-', 'logs'],
  ['logstash-', 'logs'],
  ['metricbeat-', 'metrics'],
  ['heartbeat-', 'metrics'],
  ['apm-', 'traces'],
]

const TYPE_BY_DATA_STREAM_TYPE: Record<string, DataAdoptionKind> = {
  logs: 'logs',
  metrics: 'metrics',
  traces: 'traces',
  synthetics: 'synthetics',
}

/** Strip `partial-` / `restored-` then `.ds-` / `.fs-` so backing indices match stream names. */
function stripBackingPrefixes(name: string): string {
  return name.replace(/^(partial-|restored-)/, '').replace(/^\.(ds|fs)-/, '')
}

function startsWithAny(name: string, prefixes: string[]): boolean {
  return prefixes.some(p => name.startsWith(p))
}

/**
 * Classify one index. Returns null when the index is Elastic housekeeping and must
 * be excluded. Order is significant: Security runs before the system exclusion
 * because several security indices are dot-prefixed.
 */
export function classifyIndex(name: string, traits?: IndexTraits): DataAdoptionKind | null {
  const base = stripBackingPrefixes(name)

  if (startsWithAny(base, SECURITY_PREFIXES)) return 'security'
  if (base.startsWith('.') || startsWithAny(base, PLATFORM_PREFIXES)) return null

  // Explicit mapping signal wins over names; unknown (custom) types are not guessed.
  if (traits?.dataStreamType) {
    // hasOwn: the value is customer-supplied; "constructor" etc. must not resolve via the prototype
    const t = traits.dataStreamType
    return Object.hasOwn(TYPE_BY_DATA_STREAM_TYPE, t) ? TYPE_BY_DATA_STREAM_TYPE[t] : 'other'
  }

  for (const [prefix, kind] of TYPE_BY_PREFIX) {
    if (base.startsWith(prefix)) return kind
  }
  for (const [prefix, kind] of LEGACY_PREFIXES) {
    if (base.startsWith(prefix)) return kind
  }

  if (traits?.indexMode === 'time_series') return 'metrics'
  if (traits?.indexMode === 'logsdb') return 'logs'

  // Custom-named indices with dense/sparse/semantic fields are search workloads
  if (traits?.vector) return 'vector'

  return 'other'
}

/**
 * Roll open, non-empty indices up into Logs / Metrics / Traces / Security /
 * Synthetics / Vector Search / Other. Docs and storage are primary-only. Returns null when nothing
 * qualifies so the UI can stay silent.
 */
export function buildDataAdoption(
  indices: IndexInfo[],
  traitsByIndex: Map<string, IndexTraits>
): DataAdoption | null {
  const totals = new Map<DataAdoptionKind, DataAdoptionRow>()

  for (const idx of indices) {
    if (idx.status !== 'open' || idx.docCount <= 0) continue
    const kind = classifyIndex(idx.name, traitsByIndex.get(idx.name))
    if (kind === null) continue

    const row = totals.get(kind) ?? { kind, indexCount: 0, docCount: 0, primaryStoreSizeBytes: 0 }
    row.indexCount += 1
    row.docCount += idx.docCount
    row.primaryStoreSizeBytes += idx.primaryStoreSizeBytes
    totals.set(kind, row)
  }

  const rows = ROW_ORDER.flatMap(kind => {
    const row = totals.get(kind)
    return row ? [row] : []
  })
  return rows.length > 0 ? { rows } : null
}
