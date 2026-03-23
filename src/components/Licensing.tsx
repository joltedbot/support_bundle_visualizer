import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiBadge,
  EuiText,
  EuiPanel,
} from '@elastic/eui'
import type { LicenseInfo } from '../parsers/types'

interface Props {
  license: LicenseInfo | null
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function statusColor(status: string): string {
  const s = status.toLowerCase()
  if (s === 'active') return 'success'
  if (s === 'expired') return 'danger'
  return 'warning'
}

interface StatItem {
  label: string
  value: string | React.ReactNode
}

export default function Licensing({ license }: Props) {
  if (!license) return null

  const items: StatItem[] = [
    { label: 'Type', value: license.type },
    { label: 'Status', value: <EuiBadge color={statusColor(license.status)}>{license.status}</EuiBadge> },
    { label: 'Issued to', value: license.issuedTo ?? '—' },
    { label: 'Issuer', value: license.issuer ?? '—' },
    { label: 'Issue date', value: formatDate(license.issueDate) },
    { label: 'Expiry date', value: formatDate(license.expiryDate) },
  ]

  if (license.maxNodes !== null) {
    items.push({ label: 'Max nodes', value: String(license.maxNodes) })
  }
  if (license.maxResourceUnits !== null) {
    items.push({ label: 'Max resource units', value: license.maxResourceUnits.toLocaleString() })
  }

  return (
    <EuiPanel paddingSize="m">
      <EuiFlexGroup wrap gutterSize="l" responsive={false}>
        {items.map(({ label, value }) => (
          <EuiFlexItem key={label} grow={false} style={{ minWidth: 140 }}>
            <EuiText size="xs" color="subdued">{label}</EuiText>
            <EuiText size="s" style={{ marginTop: 2 }}>
              {typeof value === 'string' ? <strong>{value}</strong> : value}
            </EuiText>
          </EuiFlexItem>
        ))}
      </EuiFlexGroup>
    </EuiPanel>
  )
}
