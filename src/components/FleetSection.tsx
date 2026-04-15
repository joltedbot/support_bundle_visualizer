import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiBadge,
  EuiText,
  EuiPanel,
  EuiSpacer,
  EuiTitle,
  EuiBasicTable,
  EuiHorizontalRule,
} from '@elastic/eui'
import type { KibanaInfo, FleetAgentPolicy, FleetPackage } from '../parsers/types'

interface Props {
  kibana: KibanaInfo | null
}

export default function FleetSection({ kibana }: Props) {
  // Always render the section header to indicate we check for Fleet
  return (
    <>
      <EuiSpacer size="l" />
      <EuiTitle size="s"><h3>Fleet & Elastic Agents</h3></EuiTitle>
      <EuiSpacer size="s" />
      {renderContent(kibana)}
    </>
  )
}

function renderContent(kibana: KibanaInfo | null) {
  if (!kibana) {
    return (
      <EuiPanel paddingSize="m">
        <EuiText color="subdued" size="s">
          No Kibana data available in this bundle to analyze Fleet status.
        </EuiText>
      </EuiPanel>
    )
  }

  const { fleet, fleetSettings, fleetPolicies, fleetInstalledPackages } = kibana
  
  const hasAgents = (fleet?.total ?? 0) > 0
  const hasCustomPolicies = fleetPolicies.some(p => !p.isPreconfigured)
  const isDeployed = hasAgents || hasCustomPolicies || fleetSettings?.isConfigured

  if (!isDeployed) {
    return (
      <EuiPanel paddingSize="m">
        <EuiText color="subdued" size="s">
          Fleet is not deployed or has no active agents/policies in this deployment.
        </EuiText>
      </EuiPanel>
    )
  }

  const policyColumns = [
    {
      field: 'name',
      name: 'Policy Name',
      render: (name: string) => <strong>{name}</strong>,
    },
    {
      field: 'agentCount',
      name: 'Agents',
      render: (count: number) => <strong>{count}</strong>,
    },
    {
      field: 'version',
      name: 'Version',
    },
    {
      field: 'status',
      name: 'Status',
      render: (status: string) => (
        <EuiBadge color={status === 'active' ? 'success' : 'hollow'}>{status}</EuiBadge>
      ),
    },
    {
      name: 'Integrations',
      render: (policy: FleetAgentPolicy) => (
        <EuiFlexGroup gutterSize="xs" wrap responsive={false}>
          {policy.packagePolicies.map(pkg => (
            <EuiFlexItem key={pkg} grow={false}>
              <EuiBadge color="hollow">{pkg}</EuiBadge>
            </EuiFlexItem>
          ))}
        </EuiFlexGroup>
      ),
    },
  ]

  const packageColumns = [
    {
      field: 'title',
      name: 'Integration',
      render: (title: string, pkg: FleetPackage) => (
        <span><strong>{title}</strong> <small style={{ color: 'var(--euiColorSubduedText)' }}>({pkg.name})</small></span>
      ),
    },
    {
      field: 'version',
      name: 'Version',
    },
    {
      name: 'Used by Policies',
      render: (pkg: FleetPackage) => pkg.policyNames.join(', ') || '—',
    },
  ]

  return (
    <EuiPanel paddingSize="m">
      <EuiFlexGroup gutterSize="l">
        {fleetSettings?.fleetServerHosts && fleetSettings.fleetServerHosts.length > 0 && (
          <EuiFlexItem grow={false}>
            <EuiText size="xs" color="subdued">Fleet Server Hosts</EuiText>
            <EuiText size="s"><strong>{fleetSettings.fleetServerHosts.join(', ')}</strong></EuiText>
          </EuiFlexItem>
        )}
        {fleet && (
          <EuiFlexItem grow={false}>
            <EuiText size="xs" color="subdued">Agent Summary</EuiText>
            <EuiText size="s">
              <strong>{fleet.total}</strong> total · <strong>{fleet.online}</strong> online
            </EuiText>
          </EuiFlexItem>
        )}
      </EuiFlexGroup>

      {fleetPolicies.length > 0 && (
        <>
          <EuiHorizontalRule margin="m" />
          <EuiText size="s" style={{ marginBottom: 12 }}><strong>Agent Policies</strong></EuiText>
          <EuiBasicTable
            items={fleetPolicies}
            columns={policyColumns}
          />
        </>
      )}

      {fleetInstalledPackages.length > 0 && (
        <>
          <EuiSpacer size="l" />
          <EuiText size="s" style={{ marginBottom: 12 }}><strong>Installed Integrations</strong></EuiText>
          <EuiBasicTable
            items={fleetInstalledPackages}
            columns={packageColumns}
          />
        </>
      )}
    </EuiPanel>
  )
}
