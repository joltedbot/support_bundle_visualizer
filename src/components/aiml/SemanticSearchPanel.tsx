import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiPanel,
  EuiStat,
  EuiText,
  EuiTitle,
  EuiSpacer,
} from '@elastic/eui'
import type {
  FeatureInfo,
} from '../../parsers/types'
import { IndexNameList } from './shared'

export function SemanticSearchPanel({ features }: { features: FeatureInfo }) {
  const semanticNames = features.semanticTextIndexNames
  const sparseNames = features.sparseVectorIndexNames ?? []
  const hasDenseGroups = features.denseVectorDimGroups.length > 0
  const hasSparseNames = sparseNames.length > 0
  const hasSemanticNames = semanticNames.length > 0

  return (
    <EuiPanel paddingSize="m">
      <EuiTitle size="xs"><h3>Semantic &amp; Vector Search</h3></EuiTitle>
      <EuiSpacer size="s" />
      <EuiFlexGroup gutterSize="m" wrap style={{ marginBottom: 12 }}>
        {[
          { label: 'Semantic Text', count: features.semanticTextIndexCount },
          { label: 'Dense Vector', count: features.denseVectorIndexCount },
          { label: 'Sparse Vector', count: features.sparseVectorIndexCount },
        ].map(({ label, count }) => (
          <EuiFlexItem key={label} grow={false}>
            <EuiStat
              title={count}
              description={label}
              titleColor={count > 0 ? 'primary' : 'subdued'}
              titleSize="s"
            />
          </EuiFlexItem>
        ))}
      </EuiFlexGroup>

      {hasDenseGroups && (
        <div style={{ marginTop: 4 }}>
          <EuiText size="xs" color="subdued" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            dense_vector
          </EuiText>
          {features.denseVectorDimGroups.map(
            ({ dims, count, inferenceId, indexNames }) => {
              const typeLabel = inferenceId
                ? inferenceId
                : `External - Dense - ${dims}dims`
              return (
                <div
                  key={`${dims}::${inferenceId ?? ''}`}
                  style={{ marginBottom: indexNames.length > 0 ? 10 : 4 }}
                >
                  <EuiFlexGroup gutterSize="xs" alignItems="center" responsive={false}>
                    <EuiFlexItem grow={false}>
                      <EuiText size="s" color="primary" component="span"><strong style={{ minWidth: 36, display: 'inline-block' }}>{dims}</strong></EuiText>
                    </EuiFlexItem>
                    <EuiFlexItem grow={false}>
                      <EuiText size="s" color="subdued" component="span">dims ·</EuiText>
                    </EuiFlexItem>
                    <EuiFlexItem grow={false}>
                      <EuiText size="s" component="span">{count} {count === 1 ? 'index' : 'indices'}</EuiText>
                    </EuiFlexItem>
                    <EuiFlexItem grow={false}>
                      <EuiText size="s" color="subdued" component="span">· {typeLabel}</EuiText>
                    </EuiFlexItem>
                  </EuiFlexGroup>
                  {indexNames.length > 0 && (
                    <div style={{ paddingLeft: 16 }}>
                      <IndexNameList names={indexNames} dotColor="#4c9aff" />
                    </div>
                  )}
                </div>
              )
            },
          )}
        </div>
      )}

      {hasSparseNames && (
        <div style={{ marginTop: hasDenseGroups ? 10 : 4 }}>
          <EuiText size="xs" color="subdued" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            sparse_vector
          </EuiText>
          <IndexNameList names={sparseNames} dotColor="#7b61ff" />
        </div>
      )}

      {hasSemanticNames && (
        <div style={{ marginTop: hasDenseGroups || hasSparseNames ? 10 : 4 }}>
          <EuiText size="xs" color="subdued" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            semantic_text
          </EuiText>
          <IndexNameList names={semanticNames} dotColor="#00bfb3" />
        </div>
      )}
    </EuiPanel>
  )
}
