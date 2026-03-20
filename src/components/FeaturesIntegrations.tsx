import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiBadge,
  EuiText,
  EuiSpacer,
} from '@elastic/eui'
import type { FeatureInfo, MLInfo, ILMInfo, ReplicationInfo, SnapshotInfo } from '../parsers/types'

interface Props {
  features: FeatureInfo
  ml: MLInfo | null
  ilm: ILMInfo | null
  replication: ReplicationInfo | null
  snapshots: SnapshotInfo | null
}

const SOLUTION_COLORS: Record<string, string> = {
  search: '#0071c2',
  observability: '#017d73',
  security: '#bd271e',
}

const SOLUTION_LABELS: Record<string, string> = {
  search: 'Search',
  observability: 'Observability',
  security: 'Security',
}

interface FeatureBadge {
  label: string
  color?: string
}

export default function FeaturesIntegrations({ features, ml, ilm, replication }: Props) {
  const badges: FeatureBadge[] = []

  if (features.hasML && ml) {
    badges.push({ label: `ML (${ml.anomalyDetectionJobCount} anomaly jobs)`, color: '#6c4a9e' })
  } else if (features.hasML) {
    badges.push({ label: 'ML', color: '#6c4a9e' })
  }

  if (features.hasILM && ilm) {
    badges.push({ label: `ILM (${ilm.policyCount} policies)`, color: '#017d73' })
  } else if (features.hasILM) {
    badges.push({ label: 'ILM', color: '#017d73' })
  }

  if (features.hasCCR && replication) {
    badges.push({ label: `CCR (${replication.followerIndexCount} followers)`, color: '#0071c2' })
  } else if (features.hasCCR) {
    badges.push({ label: 'CCR', color: '#0071c2' })
  }

  if (features.hasCCS && replication && replication.remoteClusterCount > 0) {
    badges.push({ label: `CCS (${replication.remoteClusterCount} remotes)`, color: '#0071c2' })
  } else if (features.hasCCS) {
    badges.push({ label: 'CCS', color: '#0071c2' })
  }

  if (features.hasVectorSearch) {
    badges.push({ label: 'Vector Search', color: '#f5a700' })
  }

  if (features.hasSemanticText) {
    badges.push({ label: 'Semantic Text', color: '#f5a700' })
  }

  if (features.hasIngestPipelines && features.ingestPipelineCount > 0) {
    badges.push({ label: `Ingest Pipelines (${features.ingestPipelineCount})` })
  }

  if (features.hasWatcher && features.watcherCount > 0) {
    badges.push({ label: `Watcher (${features.watcherCount})` })
  }

  if (features.hasTransforms && features.transformCount > 0) {
    badges.push({ label: `Transforms (${features.transformCount})` })
  }

  if (features.hasEnrich && features.enrichPolicyCount > 0) {
    badges.push({ label: `Enrich Policies (${features.enrichPolicyCount})` })
  }

  if (features.hasGeoFields) {
    badges.push({ label: 'Geo Fields' })
  }

  const hasSolutions = features.solutionTypes.length > 0
  const hasFeatures = badges.length > 0

  if (!hasSolutions && !hasFeatures) return null

  return (
    <div>
      {hasSolutions && (
        <>
          <EuiText size="xs" color="subdued" style={{ marginBottom: 6 }}>
            <strong>Solution type</strong>
          </EuiText>
          <EuiFlexGroup gutterSize="s" wrap responsive={false}>
            {features.solutionTypes.map((sol) => (
              <EuiFlexItem key={sol} grow={false}>
                <EuiBadge color={SOLUTION_COLORS[sol] ?? 'default'} style={{ fontSize: 13, padding: '4px 10px' }}>
                  {SOLUTION_LABELS[sol] ?? sol}
                </EuiBadge>
              </EuiFlexItem>
            ))}
          </EuiFlexGroup>
          {hasFeatures && <EuiSpacer size="m" />}
        </>
      )}

      {hasFeatures && (
        <>
          <EuiText size="xs" color="subdued" style={{ marginBottom: 6 }}>
            <strong>Detected features</strong>
          </EuiText>
          <EuiFlexGroup gutterSize="s" wrap responsive={false}>
            {badges.map((badge) => (
              <EuiFlexItem key={badge.label} grow={false}>
                <EuiBadge color={badge.color ?? 'hollow'}>{badge.label}</EuiBadge>
              </EuiFlexItem>
            ))}
          </EuiFlexGroup>
        </>
      )}
    </div>
  )
}
