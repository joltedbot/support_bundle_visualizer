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

interface NodesJson {
  nodes?: Record<string, {
    settings?: {
      telemetry?: {
        agent?: {
          global_labels?: {
            subscriptionLevel?: string
          }
        }
      }
    }
  }>
}

// On modern ESS/Cloud (7.x+), licenses.json always reports "enterprise" regardless
// of the customer's actual subscription tier. The authoritative tier lives in the
// telemetry global_labels on each node. Use it when present; fall back to
// licenses.json for self-hosted and older Cloud (6.x) clusters where the field
// doesn't exist.
function readSubscriptionLevel(files: Map<string, string>): string | null {
  const nodesJson = parseJsonFile<NodesJson>(files, 'nodes.json')
  for (const node of Object.values(nodesJson?.nodes ?? {})) {
    const level = node?.settings?.telemetry?.agent?.global_labels?.subscriptionLevel
    if (level) return level
  }
  return null
}

export function parseLicense(files: Map<string, string>): LicenseInfo | null {
  const json = parseJsonFile<LicensesJson>(files, 'licenses.json')
  const l = json?.license
  if (!l) return null

  const subscriptionLevel = readSubscriptionLevel(files)

  return {
    status: l.status ?? 'unknown',
    type: subscriptionLevel ?? l.type ?? 'unknown',
    issueDate: l.issue_date ?? null,
    expiryDate: l.expiry_date ?? null,
    maxNodes: l.max_nodes ?? null,
    maxResourceUnits: l.max_resource_units ?? null,
    issuedTo: l.issued_to ?? null,
    issuer: l.issuer ?? null,
  }
}
