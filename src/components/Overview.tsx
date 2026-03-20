import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiStat,
  EuiPanel,
} from '@elastic/eui'
import type { BundleModel } from '../parsers/types'
import { formatBytes, formatCount, healthColor } from '../utils/format'

interface Props {
  model: BundleModel
}

export default function Overview({ model }: Props) {
  const health = model.health
  const stats = model.stats

  const hStatus = health?.status ?? 'unknown'
  const hColor = healthColor(hStatus)

  const userIndices = model.indices.filter((i) => !i.isSystem)
  const totalShards = health
    ? health.activePrimaryShards + (health.activeShards - health.activePrimaryShards)
    : model.indices.reduce((s, i) => s + i.primaryShards + i.replicaShards, 0)

  return (
    <EuiFlexGroup gutterSize="m" wrap responsive={false}>
      <EuiFlexItem grow={false}>
        <EuiPanel paddingSize="m" style={{ minWidth: 120 }}>
          <EuiStat
            title={hStatus}
            description="Cluster health"
            titleColor={hColor}
            titleSize="m"
          />
        </EuiPanel>
      </EuiFlexItem>

      {health && (
        <EuiFlexItem grow={false}>
          <EuiPanel paddingSize="m" style={{ minWidth: 120 }}>
            <EuiStat
              title={String(health.numberOfNodes)}
              description="Total nodes"
              titleSize="m"
            />
          </EuiPanel>
        </EuiFlexItem>
      )}

      <EuiFlexItem grow={false}>
        <EuiPanel paddingSize="m" style={{ minWidth: 120 }}>
          <EuiStat
            title={String(userIndices.length)}
            description="User indices"
            titleSize="m"
          />
        </EuiPanel>
      </EuiFlexItem>

      <EuiFlexItem grow={false}>
        <EuiPanel paddingSize="m" style={{ minWidth: 120 }}>
          <EuiStat
            title={String(totalShards)}
            description="Active shards"
            titleSize="m"
          />
        </EuiPanel>
      </EuiFlexItem>

      {stats && (
        <>
          <EuiFlexItem grow={false}>
            <EuiPanel paddingSize="m" style={{ minWidth: 140 }}>
              <EuiStat
                title={formatBytes(stats.totalStoreSizeBytes)}
                description="Total store size"
                titleSize="m"
              />
            </EuiPanel>
          </EuiFlexItem>

          <EuiFlexItem grow={false}>
            <EuiPanel paddingSize="m" style={{ minWidth: 140 }}>
              <EuiStat
                title={formatCount(stats.totalDocCount)}
                description="Total documents"
                titleSize="m"
              />
            </EuiPanel>
          </EuiFlexItem>

          <EuiFlexItem grow={false}>
            <EuiPanel paddingSize="m" style={{ minWidth: 140 }}>
              <EuiStat
                title={formatBytes(stats.avgDocSizeBytes)}
                description="Avg doc size"
                titleSize="m"
              />
            </EuiPanel>
          </EuiFlexItem>
        </>
      )}
    </EuiFlexGroup>
  )
}
