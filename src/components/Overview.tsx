import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiStat,
  EuiPanel,
  EuiBadge,
  EuiText,
} from '@elastic/eui'
import type { BundleModel, KibanaInfo } from '../parsers/types'
import { formatBytes, formatCount, healthColor } from '../utils/format'

interface Props {
  model: BundleModel
  kibana: KibanaInfo | null
}

const SOLUTION_COLORS: Record<string, string> = {
  search:        '#0077cc',
  observability: '#006BB4',
  security:      '#017D73',
}

const SOLUTION_LABELS: Record<string, string> = {
  search:        'Search',
  observability: 'Observability',
  security:      'Security',
}

export default function Overview({ model, kibana }: Props) {
  const health = model.health
  const stats = model.stats

  const hStatus = health?.status ?? 'unknown'
  const hColor = healthColor(hStatus)

  const userIndices = model.indices.filter((i) => !i.isSystem)
  const totalShards = health
    ? health.activePrimaryShards + (health.activeShards - health.activePrimaryShards)
    : model.indices.reduce((s, i) => s + i.primaryShards + i.replicaShards, 0)

  const showSolutionCard =
    model.features !== null &&
    model.features.solutionTypes.length > 0

  const runner = model.identity?.runner?.toUpperCase()
  let deploymentLabel: string | null = null
  let deploymentSub: string | null = null
  if (runner === 'CLI') {
    deploymentLabel = 'Self-Hosted'
  } else if (runner === 'ESS') {
    deploymentLabel = 'ECH'
    const parts: string[] = []
    if (model.identity?.cloudProvider) parts.push(model.identity.cloudProvider.toUpperCase())
    if (model.identity?.region) parts.push(model.identity.region)
    if (parts.length) deploymentSub = parts.join(' · ')
  } else if (runner) {
    deploymentLabel = runner
    const parts: string[] = []
    if (model.identity?.cloudProvider) parts.push(model.identity.cloudProvider.toUpperCase())
    if (model.identity?.region) parts.push(model.identity.region)
    if (parts.length) deploymentSub = parts.join(' · ')
  }

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

      {deploymentLabel && (
        <EuiFlexItem grow={false}>
          <EuiPanel paddingSize="m" style={{ minWidth: 120 }}>
            <EuiText size="s" style={{ marginBottom: 4 }}>Deployment</EuiText>
            {deploymentSub ? (
              <>
                <EuiText size="s"><strong>{deploymentSub}</strong></EuiText>
                <EuiText size="s" style={{ marginTop: 2 }}><strong>{deploymentLabel}</strong></EuiText>
              </>
            ) : (
              <EuiText size="s"><strong>{deploymentLabel}</strong></EuiText>
            )}
          </EuiPanel>
        </EuiFlexItem>
      )}

      {showSolutionCard && (
        <EuiFlexItem grow={false}>
          <EuiPanel paddingSize="m" style={{ minWidth: 140 }}>
            <EuiText size="s" style={{ marginBottom: 4 }}>Solution</EuiText>
            <EuiFlexGroup gutterSize="xs" wrap responsive={false}>
              {model.features?.solutionTypes.map((s) => (
                <EuiFlexItem grow={false} key={s}>
                  <EuiBadge color={SOLUTION_COLORS[s] ?? 'default'}>
                    {SOLUTION_LABELS[s] ?? s}
                  </EuiBadge>
                </EuiFlexItem>
              ))}
            </EuiFlexGroup>
            {model.identity?.esVersion && (
              <EuiText size="s" style={{ marginTop: 4 }}>
                <strong>ES v{model.identity.esVersion}</strong>
              </EuiText>
            )}
            {kibana && (
              <EuiText size="s" style={{ marginTop: 2 }}>
                <strong>Kibana v{kibana.version}</strong>
              </EuiText>
            )}
          </EuiPanel>
        </EuiFlexItem>
      )}

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
