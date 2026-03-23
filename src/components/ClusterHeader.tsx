import {
  EuiHeader,
  EuiHeaderSectionItem,
  EuiText,
  EuiButton,
  EuiFlexGroup,
  EuiFlexItem,
} from '@elastic/eui'
import type { BundleModel } from '../parsers/types'

interface Props {
  model: BundleModel
  customerName: string
  clusterName: string | null
  generatedAt: string  // ISO string
}

export default function ClusterHeader({ model, customerName, clusterName, generatedAt }: Props) {

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
                {clusterName && (
                  <>
                    <EuiFlexItem grow={false}>
                      <EuiText size="s" color="subdued">·</EuiText>
                    </EuiFlexItem>
                    <EuiFlexItem grow={false}>
                      <EuiText size="s" color="subdued">{clusterName}</EuiText>
                    </EuiFlexItem>
                  </>
                )}
                {collectedAt && (
                  <>
                    <EuiFlexItem grow={false}>
                      <EuiText size="s" color="subdued">·</EuiText>
                    </EuiFlexItem>
                    <EuiFlexItem grow={false}>
                      <EuiText size="s" color="subdued">Collected: {collectedAt}</EuiText>
                    </EuiFlexItem>
                  </>
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
