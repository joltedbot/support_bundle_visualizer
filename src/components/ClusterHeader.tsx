import {
  EuiHeader,
  EuiHeaderSectionItem,
  EuiBadge,
  EuiText,
  EuiButton,
  EuiFlexGroup,
  EuiFlexItem,
} from '@elastic/eui'
import type { BundleModel } from '../parsers/types'
import { healthColor } from '../utils/format'

interface Props {
  model: BundleModel
  customerName: string
  generatedAt: string  // ISO string
}

export default function ClusterHeader({ model, customerName, generatedAt }: Props) {
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

  const generatedAtStr = new Date(generatedAt).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })

  function handleExport() {
    const html = document.documentElement.outerHTML
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bundle-report-${customerName.replace(/[^a-z0-9]/gi, '-')}-${new Date().toISOString().slice(0, 10)}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <EuiHeader
      style={{ position: 'sticky', top: 0, zIndex: 1000 }}
      sections={[
        {
          items: [
            <EuiHeaderSectionItem key="name">
              <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
                <EuiFlexItem grow={false}>
                  <EuiText>
                    <strong style={{ fontSize: 16 }}>{customerName}</strong>
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
              </EuiFlexGroup>
            </EuiHeaderSectionItem>,
          ],
        },
        {
          items: [
            <EuiHeaderSectionItem key="actions">
              <EuiFlexGroup alignItems="center" gutterSize="m" responsive={false}>
                <EuiFlexItem grow={false}>
                  <EuiText size="xs" color="subdued">
                    Generated {generatedAtStr}
                  </EuiText>
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiButton size="s" iconType="download" onClick={handleExport}>
                    Export HTML
                  </EuiButton>
                </EuiFlexItem>
              </EuiFlexGroup>
            </EuiHeaderSectionItem>,
          ],
        },
      ]}
    />
  )
}
