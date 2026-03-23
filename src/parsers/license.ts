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

export function parseLicense(files: Map<string, string>): LicenseInfo | null {
  const json = parseJsonFile<LicensesJson>(files, 'licenses.json')
  const l = json?.license
  if (!l) return null

  return {
    status: l.status ?? 'unknown',
    type: l.type ?? 'unknown',
    issueDate: l.issue_date ?? null,
    expiryDate: l.expiry_date ?? null,
    maxNodes: l.max_nodes ?? null,
    maxResourceUnits: l.max_resource_units ?? null,
    issuedTo: l.issued_to ?? null,
    issuer: l.issuer ?? null,
  }
}
