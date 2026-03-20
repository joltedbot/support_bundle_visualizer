import { useState } from 'react'
import {
  EuiHeader,
  EuiHeaderSectionItem,
  EuiBadge,
  EuiText,
  EuiButton,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFieldText,
  EuiFormRow,
  EuiCallOut,
  EuiSpacer,
} from '@elastic/eui'
import type { BundleModel } from '../parsers/types'
import { healthColor } from '../utils/format'

interface Props {
  model: BundleModel
  bundleRootName: string
  onReset: () => void
}

const UUID_RE = /^[0-9a-f-]{32,36}$/i

export default function ClusterHeader({ model, bundleRootName, onReset }: Props) {
  const rawName = model.identity?.clusterName ?? bundleRootName
  const looksLikeUUID = UUID_RE.test(rawName.replace(/-/g, ''))

  const [customName, setCustomName] = useState('')
  const [customDeploymentId, setCustomDeploymentId] = useState('')

  const displayName = customName || rawName
  const health = model.health?.status ?? 'unknown'
  const hColor = healthColor(health)

  const nodeCount = model.health?.numberOfNodes ?? model.nodes.length
  const indexCount = model.indices.filter((i) => !i.isSystem).length

  const regionParts: string[] = []
  if (model.identity?.cloudProvider) regionParts.push(model.identity.cloudProvider.toUpperCase())
  if (model.identity?.region) regionParts.push(model.identity.region)
  if (model.identity?.runner) regionParts.push(model.identity.runner)
  const regionStr = regionParts.join(' · ')

  const collectedAt = model.identity?.collectionTimestamp
    ? new Date(model.identity.collectionTimestamp).toLocaleString()
    : null

  function handleExport() {
    const html = document.documentElement.outerHTML
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bundle-report-${displayName.replace(/[^a-z0-9]/gi, '-')}-${new Date().toISOString().slice(0, 10)}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <EuiHeader
        style={{ position: 'sticky', top: 0, zIndex: 1000 }}
        sections={[
          {
            items: [
              <EuiHeaderSectionItem key="name">
                <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
                  <EuiFlexItem grow={false}>
                    <EuiText>
                      <strong style={{ fontSize: 16 }}>{displayName}</strong>
                    </EuiText>
                  </EuiFlexItem>
                  <EuiFlexItem grow={false}>
                    <EuiBadge color={hColor}>{health}</EuiBadge>
                  </EuiFlexItem>
                  {model.identity?.esVersion && (
                    <EuiFlexItem grow={false}>
                      <EuiText size="s" color="subdued">
                        v{model.identity.esVersion}
                      </EuiText>
                    </EuiFlexItem>
                  )}
                  <EuiFlexItem grow={false}>
                    <EuiText size="s" color="subdued">
                      {nodeCount} nodes · {indexCount} indices
                    </EuiText>
                  </EuiFlexItem>
                  {regionStr && (
                    <EuiFlexItem grow={false}>
                      <EuiText size="s" color="subdued">
                        {regionStr}
                      </EuiText>
                    </EuiFlexItem>
                  )}
                  {collectedAt && (
                    <EuiFlexItem grow={false}>
                      <EuiText size="s" color="subdued">
                        Collected: {collectedAt}
                      </EuiText>
                    </EuiFlexItem>
                  )}
                  {customDeploymentId && (
                    <EuiFlexItem grow={false}>
                      <EuiText size="s" color="subdued">
                        Deployment: {customDeploymentId}
                      </EuiText>
                    </EuiFlexItem>
                  )}
                </EuiFlexGroup>
              </EuiHeaderSectionItem>,
            ],
          },
          {
            items: [
              <EuiHeaderSectionItem key="export">
                <EuiFlexGroup gutterSize="s" responsive={false}>
                  <EuiFlexItem grow={false}>
                    <EuiButton size="s" iconType="download" onClick={handleExport}>
                      Export HTML
                    </EuiButton>
                  </EuiFlexItem>
                  <EuiFlexItem grow={false}>
                    <EuiButton size="s" onClick={onReset}>
                      Load another bundle
                    </EuiButton>
                  </EuiFlexItem>
                </EuiFlexGroup>
              </EuiHeaderSectionItem>,
            ],
          },
        ]}
      />

      {looksLikeUUID && (
        <div style={{ padding: '8px 16px', background: '#1a1b20' }}>
          <EuiCallOut
            size="s"
            title="Cluster name looks like a UUID — add context (optional)"
            iconType="iInCircle"
          >
            <EuiSpacer size="s" />
            <EuiFlexGroup gutterSize="m" alignItems="flexEnd" responsive={false}>
              <EuiFlexItem grow={false}>
                <EuiFormRow label="Customer name" display="rowCompressed">
                  <EuiFieldText
                    compressed
                    placeholder="Acme Corp"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                  />
                </EuiFormRow>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiFormRow label="Deployment ID" display="rowCompressed">
                  <EuiFieldText
                    compressed
                    placeholder="abc123..."
                    value={customDeploymentId}
                    onChange={(e) => setCustomDeploymentId(e.target.value)}
                  />
                </EuiFormRow>
              </EuiFlexItem>
            </EuiFlexGroup>
          </EuiCallOut>
        </div>
      )}
    </>
  )
}
