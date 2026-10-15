import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiPanel,
  EuiText,
  EuiTitle,
  EuiSpacer,
} from '@elastic/eui'
import type {
  MLNodeMemory,
} from '../../parsers/types'
import { usePalette } from '../../theme/palette'
import { formatBytes } from '../../utils/format'
import { memBarLevel } from './labels'

export function MLMemoryPanel({ nodes }: { nodes: MLNodeMemory[] }) {
  const palette = usePalette()
  return (
    <EuiPanel paddingSize="m">
      <EuiTitle size="xs"><h3>ML Memory</h3></EuiTitle>
      <EuiSpacer size="s" />
      {nodes.map((node) => {
        const usedBytes =
          node.anomalyDetectorsBytes +
          node.nativeInferenceBytes +
          node.dataFrameAnalyticsBytes
        const usedPct = Math.round((usedBytes / node.maxBytes) * 100)
        const adPct = (node.anomalyDetectorsBytes / node.maxBytes) * 100
        const infPct = (node.nativeInferenceBytes / node.maxBytes) * 100
        const dfaPct = (node.dataFrameAnalyticsBytes / node.maxBytes) * 100
        return (
          <div key={node.nodeName} style={{ marginBottom: 14 }}>
            <EuiFlexGroup
              justifyContent="flexStart"
              alignItems="center"
              gutterSize="s"
              responsive={false}
              style={{ marginBottom: 4 }}
            >
              <EuiFlexItem grow={false}>
                <EuiText size="xs" color="subdued">
                  {node.nodeName}
                </EuiText>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiText size="xs" color="subdued">
                  —
                </EuiText>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiText size="xs" style={{ color: palette[memBarLevel(usedPct)] }}>
                  {usedPct}% — {formatBytes(usedBytes)} /{' '}
                  {formatBytes(node.maxBytes)}
                </EuiText>
              </EuiFlexItem>
            </EuiFlexGroup>
            {/* Stacked bar: yellow=AD, blue=inference, purple=DFA */}
            <div
              style={{
                height: 10,
                background: palette.memBar.track,
                borderRadius: 5,
                overflow: 'hidden',
                display: 'flex',
              }}
            >
              {adPct > 0 && (
                <div
                  style={{ width: `${adPct}%`, background: palette.memBar.anomalyDetection }}
                  title={`Anomaly detectors: ${formatBytes(node.anomalyDetectorsBytes)}`}
                />
              )}
              {infPct > 0 && (
                <div
                  style={{ width: `${infPct}%`, background: palette.memBar.inference }}
                  title={`Native inference: ${formatBytes(node.nativeInferenceBytes)}`}
                />
              )}
              {dfaPct > 0 && (
                <div
                  style={{ width: `${dfaPct}%`, background: palette.memBar.dataFrameAnalytics }}
                  title={`Data frame analytics: ${formatBytes(node.dataFrameAnalyticsBytes)}`}
                />
              )}
            </div>
          </div>
        )
      })}
      <EuiText size="xs" color="subdued" style={{ marginTop: 4 }}>
        Yellow = anomaly detectors · Blue = native inference · Pink = data
        frame analytics
      </EuiText>
    </EuiPanel>
  )
}
