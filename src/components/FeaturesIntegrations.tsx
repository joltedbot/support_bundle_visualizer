import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiBadge,
  EuiText,
  EuiSpacer,
} from '@elastic/eui'
import type { FeatureInfo, MLInfo, ILMInfo, ReplicationInfo, SnapshotInfo, KibanaInfo } from '../parsers/types'

interface Props {
  features: FeatureInfo | null
  ml: MLInfo | null
  ilm: ILMInfo | null
  replication: ReplicationInfo | null
  snapshots: SnapshotInfo | null
  kibana: KibanaInfo | null
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

export default function FeaturesIntegrations({ features, ml, ilm, replication, kibana }: Props) {
  const badges: FeatureBadge[] = []

  if (features?.hasML && ml) {
    badges.push({ label: `ML (${ml.anomalyDetectionJobCount} anomaly jobs)`, color: '#6c4a9e' })
  } else if (features?.hasML) {
    badges.push({ label: 'ML', color: '#6c4a9e' })
  }

  if (features?.hasILM && ilm) {
    badges.push({ label: `ILM (${ilm.policyCount} policies)`, color: '#017d73' })
  } else if (features?.hasILM) {
    badges.push({ label: 'ILM', color: '#017d73' })
  }

  if (features?.hasCCR && replication) {
    badges.push({ label: `CCR (${replication.followerIndexCount} followers)`, color: '#0071c2' })
  } else if (features?.hasCCR) {
    badges.push({ label: 'CCR', color: '#0071c2' })
  }

  if (features?.hasCCS && replication && replication.remoteClusterCount > 0) {
    badges.push({ label: `CCS (${replication.remoteClusterCount} remotes)`, color: '#0071c2' })
  } else if (features?.hasCCS) {
    badges.push({ label: 'CCS', color: '#0071c2' })
  }

  if (features?.hasVectorSearch) {
    badges.push({ label: 'Vector Search', color: '#f5a700' })
  }

  if (features?.hasSemanticText) {
    badges.push({ label: 'Semantic Text', color: '#f5a700' })
  }

  if (features?.hasIngestPipelines && features.ingestPipelineCount > 0) {
    badges.push({ label: `Ingest Pipelines (${features.ingestPipelineCount})` })
  }

  if (features?.hasWatcher && features.watcherCount > 0) {
    badges.push({ label: `Watcher (${features.watcherCount})` })
  }

  if (features?.hasTransforms && features.transformCount > 0) {
    badges.push({ label: `Transforms (${features.transformCount})` })
  }

  if (features?.hasEnrich && features.enrichPolicyCount > 0) {
    badges.push({ label: `Enrich Policies (${features.enrichPolicyCount})` })
  }

  if (features?.hasGeoFields) {
    badges.push({ label: 'Geo Fields' })
  }

  // Kibana health badges
  interface KibanaBadge { label: string; color: string }
  const kibanaBadges: KibanaBadge[] = []
  if (kibana) {
    const alertColor = kibana.alertingHealth === 'ok' ? '#017d73' : kibana.alertingHealth === 'warn' ? '#f5a700' : kibana.alertingHealth === 'error' ? '#bd271e' : '#69707d'
    if (kibana.alertingHealth) {
      kibanaBadges.push({ label: `Alerting: ${kibana.alertingHealth}`, color: alertColor })
    }
    if (kibana.hasPermanentEncryptionKey === false) {
      kibanaBadges.push({ label: 'No permanent encryption key', color: '#bd271e' })
    }
    if (kibana.taskManagerStatus) {
      const tmColor = kibana.taskManagerStatus === 'OK' ? '#017d73' : kibana.taskManagerStatus === 'warn' ? '#f5a700' : '#bd271e'
      kibanaBadges.push({ label: `Task Manager: ${kibana.taskManagerStatus}`, color: tmColor })
    }
    if (kibana.fleet && kibana.fleet.total > 0) {
      const f = kibana.fleet
      const parts: string[] = []
      if (f.online > 0)   parts.push(`${f.online} online`)
      if (f.offline > 0)  parts.push(`${f.offline} offline`)
      if (f.error > 0)    parts.push(`${f.error} error`)
      if (f.updating > 0) parts.push(`${f.updating} updating`)
      if (f.inactive > 0) parts.push(`${f.inactive} inactive`)
      kibanaBadges.push({ label: `Fleet: ${parts.join(', ')}`, color: '#0071c2' })
    }
  }

  const hasSolutions = (features?.solutionTypes.length ?? 0) > 0
  const hasFeatures = badges.length > 0
  const hasKibanaHealth = kibanaBadges.length > 0

  if (!hasSolutions && !hasFeatures && !hasKibanaHealth) return null

  return (
    <div>
      {hasSolutions && (
        <>
          <EuiText size="xs" color="subdued" style={{ marginBottom: 6 }}>
            <strong>Solution type</strong>
          </EuiText>
          <EuiFlexGroup gutterSize="s" wrap responsive={false}>
            {features?.solutionTypes.map((sol) => (
              <EuiFlexItem key={sol} grow={false}>
                <EuiBadge color={SOLUTION_COLORS[sol] ?? 'default'} style={{ fontSize: 13, padding: '4px 10px' }}>
                  {SOLUTION_LABELS[sol] ?? sol}
                </EuiBadge>
              </EuiFlexItem>
            ))}
          </EuiFlexGroup>
          {(hasFeatures || hasKibanaHealth) && <EuiSpacer size="m" />}
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
          {hasKibanaHealth && <EuiSpacer size="m" />}
        </>
      )}

      {hasKibanaHealth && (
        <>
          <EuiText size="xs" color="subdued" style={{ marginBottom: 6 }}>
            <strong>Kibana health</strong>
          </EuiText>
          <EuiFlexGroup gutterSize="s" wrap responsive={false}>
            {kibanaBadges.map((badge) => (
              <EuiFlexItem key={badge.label} grow={false}>
                <EuiBadge color={badge.color}>{badge.label}</EuiBadge>
              </EuiFlexItem>
            ))}
          </EuiFlexGroup>
        </>
      )}
    </div>
  )
}
