import { describe, it, expect } from 'vitest'
import { buildDataAdoption, classifyIndex } from './dataAdoption'
import type { IndexTraits } from './indexTraits'
import type { IndexInfo } from './types'

const traits = (over: Partial<IndexTraits> = {}): IndexTraits => ({
  indexMode: 'standard',
  syntheticSource: false,
  ...over,
})

function idx(name: string, over: Partial<IndexInfo> = {}): IndexInfo {
  return {
    name,
    isSystem: name.startsWith('.'),
    health: 'green',
    status: 'open',
    primaryShards: 1,
    replicaShards: 1,
    docCount: 100,
    storeSizeBytes: 2000,
    primaryStoreSizeBytes: 1000,
    avgShardSizeBytes: 1000,
    ...over,
  }
}

describe('classifyIndex — name prefixes', () => {
  it.each([
    ['logs-nginx.access-default', 'logs'],
    ['metrics-system.cpu-default', 'metrics'],
    ['traces-apm-default', 'traces'],
    ['synthetics-http-default', 'synthetics'],
  ])('%s -> %s', (name, kind) => {
    expect(classifyIndex(name)).toBe(kind)
  })

  it('strips .ds-, partial-, restored- and .fs- before matching', () => {
    expect(classifyIndex('.ds-logs-app-default-2026.01.01-000001')).toBe('logs')
    expect(classifyIndex('partial-.ds-traces-apm-default-2026.01.01-000001')).toBe('traces')
    expect(classifyIndex('restored-.ds-metrics-x-default-2026.01.01-000001')).toBe('metrics')
    expect(classifyIndex('.fs-traces-apm-default-2026.01.01-000001')).toBe('traces')
  })

  it('does not match a prefix in the middle of a name', () => {
    expect(classifyIndex('fm-clone-dz8f-.ds-logs-kubernetes.container_logs-default')).toBe('other')
  })
})

describe('classifyIndex — legacy shipper names', () => {
  it.each([
    ['filebeat-7.17.0-2026.01.01', 'logs'],
    ['winlogbeat-8.1.0', 'logs'],
    ['logstash-2026.01.01', 'logs'],
    ['metricbeat-8.15.2-2026.01.01', 'metrics'],
    ['.ds-metricbeat-8.17.3-2026.01.01-000001', 'metrics'],
    ['apm-7.16.3-transaction-000013', 'traces'],
  ])('%s -> %s', (name, kind) => {
    expect(classifyIndex(name)).toBe(kind)
  })
})

describe('classifyIndex — security', () => {
  it.each([
    '.internal.alerts-security.alerts-default-000001',
    '.alerts-security.alerts-default-000001',
    '.ds-logs-endpoint.events.process-default-2026.01.01-000001',
    'logs-endpoint.events.network-default',
    '.ds-metrics-endpoint.policy-default-2026.01.01-000001',
    'risk-score.risk-score-latest-default',
    '.ds-risk-score.risk-score-default-2026.01.01-000001',
    '.entities.v1.latest.security_user_default',
    'logs-ti_opencti.indicator-default',
    'security_solution-microsoft_defender_endpoint.vulnerability_latest-v3',
    '.lists-default',
    '.items-default',
  ])('%s -> security', (name) => {
    expect(classifyIndex(name)).toBe('security')
  })

  it('runs before system exclusion (dot-prefixed security index is kept)', () => {
    expect(classifyIndex('.internal.alerts-security.alerts-default-000001')).not.toBeNull()
  })

  it('beats data_stream.type', () => {
    expect(classifyIndex('logs-endpoint.events.file-default', traits({ dataStreamType: 'logs' }))).toBe('security')
  })

  it('does not treat vendor security-named datasets as Security', () => {
    expect(classifyIndex('logs-system.security-default')).toBe('logs')
    expect(classifyIndex('logs-akamai.siem-default')).toBe('logs')
    expect(classifyIndex('logs-microsoft_defender_cloud.event-default')).toBe('logs')
  })
})

describe('classifyIndex — system exclusion', () => {
  it.each([
    '.kibana_8.15.0_001',
    '.security-7',
    '.ds-ilm-history-7-2026.01.01-000001',
    '.ds-.slm-history-7-2026.01.01-000001',
    '.ds-elastic-cloud-logs-8-2026.01.01-000001',
    '.ds-.monitoring-es-8-mb-2026.01.01',
    '.ds-.kibana-event-log-ds-2026.01.01-000001',
    '.apm-source-map',
    '.ds-.logs-app-default-2026.01.01-000001',
  ])('%s is excluded', (name) => {
    expect(classifyIndex(name)).toBeNull()
  })

  it('excludes housekeeping even when the mapping says logs', () => {
    expect(classifyIndex('.ds-elastic-cloud-logs-8-2026.01.01-000001', traits({ dataStreamType: 'logs' }))).toBeNull()
  })
})

describe('classifyIndex — data_stream.type', () => {
  it('classifies a custom-named stream by its mapped type', () => {
    expect(classifyIndex('.ds-cdn-fastly-2026.01.01-000001', traits({ dataStreamType: 'logs' }))).toBe('logs')
    expect(classifyIndex('my-stream', traits({ dataStreamType: 'synthetics' }))).toBe('synthetics')
  })

  it('beats the name prefix', () => {
    expect(classifyIndex('logs-weird-default', traits({ dataStreamType: 'metrics' }))).toBe('metrics')
  })

  it('sends a custom type to Other without falling back to the name', () => {
    expect(classifyIndex('logs-weird-default', traits({ dataStreamType: 'arch' }))).toBe('other')
  })
})

describe('classifyIndex — hostile data_stream.type values', () => {
  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])('%s -> other, not an inherited member', (v) => {
    expect(classifyIndex('logs-x-default', traits({ dataStreamType: v }))).toBe('other')
  })
})

describe('classifyIndex — index.mode fallback', () => {
  it('time_series -> metrics', () => {
    expect(classifyIndex('custom-ts', traits({ indexMode: 'time_series' }))).toBe('metrics')
  })

  it('logsdb -> logs', () => {
    expect(classifyIndex('custom-logs', traits({ indexMode: 'logsdb' }))).toBe('logs')
  })

  it('name prefix beats mode', () => {
    expect(classifyIndex('traces-x-default', traits({ indexMode: 'logsdb' }))).toBe('traces')
  })

  it('lookup and standard stay Other', () => {
    expect(classifyIndex('custom-lookup', traits({ indexMode: 'lookup' }))).toBe('other')
    expect(classifyIndex('products', traits())).toBe('other')
    expect(classifyIndex('products')).toBe('other')
  })
})

describe('buildDataAdoption', () => {
  it('returns null when there are no indices', () => {
    expect(buildDataAdoption([], new Map())).toBeNull()
  })

  it('returns null when everything is excluded, closed or empty', () => {
    const indices = [
      idx('.kibana_1'),
      idx('logs-a-default', { status: 'close' }),
      idx('logs-b-default', { docCount: 0 }),
    ]
    expect(buildDataAdoption(indices, new Map())).toBeNull()
  })

  it('sums docs and primary storage (not total store) per row in fixed order', () => {
    const indices = [
      idx('products', { docCount: 5, primaryStoreSizeBytes: 50 }),
      idx('.ds-logs-a-default-2026.01.01-000001', { docCount: 10, primaryStoreSizeBytes: 100, storeSizeBytes: 9999 }),
      idx('.ds-logs-a-default-2026.01.02-000002', { docCount: 20, primaryStoreSizeBytes: 200 }),
      idx('metrics-b-default', { docCount: 7, primaryStoreSizeBytes: 70 }),
      idx('.internal.alerts-security.alerts-default-000001', { docCount: 3, primaryStoreSizeBytes: 30 }),
    ]
    const result = buildDataAdoption(indices, new Map())
    expect(result?.rows.map(r => r.kind)).toEqual(['logs', 'metrics', 'security', 'other'])
    expect(result?.rows[0]).toEqual({ kind: 'logs', indexCount: 2, docCount: 30, primaryStoreSizeBytes: 300 })
  })

  it('omits rows with no qualifying indices and keeps row totals equal to classified indices', () => {
    const indices = [idx('traces-apm-default'), idx('traces-apm.rum-default'), idx('.ds-ilm-history-7-2026.01.01-000001')]
    const result = buildDataAdoption(indices, new Map())
    expect(result?.rows).toHaveLength(1)
    expect(result?.rows[0].indexCount).toBe(2)
  })

  it('uses traits keyed by index name', () => {
    const indices = [idx('.ds-cdn-fastly-2026.01.01-000001')]
    const t = new Map([['.ds-cdn-fastly-2026.01.01-000001', traits({ dataStreamType: 'logs' })]])
    expect(buildDataAdoption(indices, t)?.rows[0].kind).toBe('logs')
  })
})
