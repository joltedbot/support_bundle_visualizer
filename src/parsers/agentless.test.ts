import { describe, it, expect } from 'vitest'
import { buildAgentlessIntegrations } from './agentless'

const idx = (name: string, docCount: number, status: 'open' | 'close' = 'open') => ({ name, docCount, status })
const kibana = (policies: Array<[string, string, number, number]>) => ({
  agentlessPolicies: policies.map(([name, packageName, agentsOnline, agentsTotal]) => ({ name, packageName, agentsOnline, agentsTotal })),
})

describe('buildAgentlessIntegrations', () => {
  it('marks an integration receiving when a matching backing index has documents', () => {
    const result = buildAgentlessIntegrations(
      kibana([['Agentless policy for ti_abusech', 'ti_abusech', 1, 1]]),
      [idx('.ds-logs-ti_abusech.url-default-2026.10.13-000027', 120)]
    )
    expect(result).toEqual([{ name: 'ti_abusech', status: 'receiving', agentsOnline: 1 }])
  })

  it('is installed-only when the matching indices are empty, closed or absent', () => {
    const k = kibana([['Agentless policy for ess_billing-1', 'ess_billing', 0, 0]])
    expect(buildAgentlessIntegrations(k, [idx('.ds-metrics-ess_billing.billing-default-2026.10.13-000001', 0)])[0].status).toBe('installed')
    expect(buildAgentlessIntegrations(k, [idx('.ds-metrics-ess_billing.billing-default-2026.10.13-000001', 5, 'close')])[0].status).toBe('installed')
    expect(buildAgentlessIntegrations(k, [])[0]).toEqual({ name: 'ess_billing', status: 'installed', agentsOnline: null })
  })

  it('counts any dataset of a multi-dataset package', () => {
    const result = buildAgentlessIntegrations(
      kibana([['Agentless policy for ti_abusech', 'ti_abusech', 0, 0]]),
      [idx('.ds-logs-ti_abusech.url-default-2026.10.13-000027', 0), idx('.ds-logs-ti_abusech.malware-default-2026.10.13-000025', 7)]
    )
    expect(result[0].status).toBe('receiving')
  })

  it('falls back to the policy name when the package name is empty', () => {
    const result = buildAgentlessIntegrations(kibana([['Odd policy', '', 0, 0]]), [idx('.ds-logs-x.y-default-1', 5)])
    expect(result).toEqual([{ name: 'Odd policy', status: 'installed', agentsOnline: null }])
  })

  it('does not match a different package that shares a prefix', () => {
    const result = buildAgentlessIntegrations(
      kibana([['Agentless policy for ti_abuse', 'ti_abuse', 0, 1]]),
      [idx('.ds-logs-ti_abusech.url-default-2026.10.13-000027', 120)]
    )
    expect(result[0].status).toBe('installed')
  })

  it('returns an empty list without Kibana data and never throws on regex characters', () => {
    expect(buildAgentlessIntegrations(null, [])).toEqual([])
    expect(buildAgentlessIntegrations(kibana([['x', 'a(b[', 0, 0]]), [idx('.ds-logs-a(b[.x', 1)])).toHaveLength(1)
  })
})
