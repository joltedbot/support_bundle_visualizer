import { parseJsonFile } from '../utils/bundleReader'
import type { LicenseInfo } from './types'

interface LicensesJson {
  license?: {
    status?: string
    type?: string
    issue_date?: string
    expiry_date?: string
    max_nodes?: number | null
    max_resource_units?: number | null
    issued_to?: string
    issuer?: string
  }
}

interface NodeGlobalLabels {
  subscriptionLevel?: string
}

interface NodesJson {
  nodes?: Record<string, {
    settings?: {
      // 8.19+
      telemetry?: { agent?: { global_labels?: NodeGlobalLabels } }
      // 8.6 and earlier — key renamed between these versions
      tracing?: { apm?: { agent?: { global_labels?: NodeGlobalLabels } } }
    }
  }>
}

function readSubscriptionLevel(files: Map<string, string>): string | null {
  const nodesJson = parseJsonFile<NodesJson>(files, 'nodes.json')
  for (const node of Object.values(nodesJson?.nodes ?? {})) {
    const s = node?.settings
    const level =
      s?.telemetry?.agent?.global_labels?.subscriptionLevel ??
      s?.tracing?.apm?.agent?.global_labels?.subscriptionLevel
    if (level) return level
  }
  return null
}

// Resolve the customer's actual subscription tier from the available data sources.
//
// On ESS/Cloud (7.x+) the platform issues a single "enterprise" license to every
// cluster regardless of what the customer purchased, so licenses.json is not
// reliable for tier display. Resolution order:
//
//   1. subscriptionLevel in node telemetry global_labels — always authoritative
//      when present (checked in both the 8.19+ and <=8.6 config key locations)
//   2. licenses.json type that is NOT "enterprise" — any specific tier
//      (platinum, gold, standard, basic, trial) is accurate on both self-hosted
//      and pre-7.x Cloud where the enterprise platform license didn't exist
//   3. licenses.json type is "enterprise" + issued_to is "Elastic Cloud" — the
//      platform license is masking the real tier and no override is available;
//      return "unknown" rather than a confidently wrong value
//   4. licenses.json type is "enterprise" + not Cloud — genuine self-hosted
//      enterprise license; use it
function resolveType(licType: string | undefined, issuedTo: string | undefined, subscriptionLevel: string | null): string {
  if (subscriptionLevel) return subscriptionLevel
  if (licType !== 'enterprise') return licType ?? 'unknown'
  if (issuedTo === 'Elastic Cloud') return 'unknown'
  return 'enterprise'
}

export function parseLicense(files: Map<string, string>): LicenseInfo | null {
  const json = parseJsonFile<LicensesJson>(files, 'licenses.json')
  const l = json?.license
  if (!l) return null

  return {
    status: l.status ?? 'unknown',
    type: resolveType(l.type, l.issued_to, readSubscriptionLevel(files)),
    issueDate: l.issue_date ?? null,
    expiryDate: l.expiry_date ?? null,
    maxNodes: l.max_nodes ?? null,
    maxResourceUnits: l.max_resource_units ?? null,
    issuedTo: l.issued_to ?? null,
    issuer: l.issuer ?? null,
  }
}
