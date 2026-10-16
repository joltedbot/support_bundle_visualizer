import type { AgentlessIntegration, IndexInfo, KibanaInfo } from './types'

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Agentless integrations: Fleet policies running agentless (Kibana bundle), marked "receiving"
 * when a backing index of a `<type>-<package>.<dataset>-*` data stream holds documents.
 * Pure function over already-parsed data, so it runs on the client without touching generate.ts.
 */
export function buildAgentlessIntegrations(
  kibana: Pick<KibanaInfo, 'agentlessPolicies'> | null,
  indices: readonly Pick<IndexInfo, 'name' | 'docCount' | 'status'>[]
): AgentlessIntegration[] {
  if (!kibana) return []
  return kibana.agentlessPolicies.map((policy) => {
    // Package names are customer-visible strings: escape before building a pattern.
    // Assumes Fleet's `.ds-<type>-<package>.<dataset>-<namespace>-<date>-<gen>` backing names
    // with a lowercase letters-only type (logs, metrics, traces, synthetics); one package can
    // own several datasets, any of which counts.
    const backing = new RegExp(`^\\.ds-[a-z]+-${escapeRegExp(policy.packageName)}\\.`)
    const receiving = policy.packageName !== '' &&
      indices.some(i => i.status === 'open' && i.docCount > 0 && backing.test(i.name))
    return {
      name: policy.packageName || policy.name,
      status: receiving ? 'receiving' : 'installed',
      agentsOnline: policy.agentsTotal > 0 ? policy.agentsOnline : null,
    }
  })
}
