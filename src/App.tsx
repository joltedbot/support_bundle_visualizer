import { bundleData as rawBundleData } from './generated/bundleData'
import type { GeneratedBundle } from './parsers/types'
import {
  EuiPage,
  EuiPageBody,
  EuiEmptyPrompt,
  EuiText,
  EuiSpacer,
  EuiTitle,
  EuiPanel,
} from '@elastic/eui'
import ClusterHeader from './components/ClusterHeader'
import Overview from './components/Overview'
import Licensing from './components/Licensing'
import Topology from './components/Topology'
import FeaturesIntegrations from './components/FeaturesIntegrations'
import DataProfile, { ILMPoliciesTable } from './components/DataProfile'
import AiMlSection from './components/AiMlSection'
import IndexLandscape from './components/IndexLandscape'
import DataStreams from './components/DataStreams'
import IngestPipelines from './components/IngestPipelines'
import CrossCluster from './components/CrossCluster'
import Plugins from './components/Plugins'
import BestPractices from './components/BestPractices'

const data = rawBundleData as unknown as GeneratedBundle

function App() {
  if (!data.model) {
    return (
      <EuiPage paddingSize="l">
        <EuiPageBody>
          <EuiEmptyPrompt
            title={<h2>No bundle data generated</h2>}
            body={
              <EuiText>
                <p>
                  Run <code>npm run generate</code> to process a diagnostic bundle before building.
                </p>
                <p>
                  See <code>GENERATE.md</code> for the full workflow.
                </p>
              </EuiText>
            }
          />
        </EuiPageBody>
      </EuiPage>
    )
  }

  const { model, customerName, clusterName, generatedAt, notes, kibana } = data
  return (
    <>
      <ClusterHeader
        model={model}
        customerName={customerName}
        clusterName={clusterName ?? null}
        generatedAt={generatedAt!}
      />
      <EuiPage paddingSize="l">
        <EuiPageBody>
          <EuiSpacer size="l" />
          <Overview model={model} kibana={kibana ?? null} />

          {model.license && (
            <>
              <EuiSpacer size="l" />
              <EuiTitle size="s"><h3>Licensing</h3></EuiTitle>
              <EuiSpacer size="s" />
              <Licensing license={model.license} />
            </>
          )}

          <EuiSpacer size="l" />
          <EuiTitle size="s"><h3>Topology</h3></EuiTitle>
          <EuiSpacer size="s" />
          <Topology
            nodes={model.nodes}
            kibana={kibana ?? null}
            maxShardsPerNode={model.clusterSettings?.maxShardsPerNode ?? null}
            maxShardsPerNodeFrozen={model.clusterSettings?.maxShardsPerNodeFrozen ?? null}
          />

          {(model.features || kibana) && (
            <>
              <EuiSpacer size="l" />
              <EuiTitle size="s"><h3>Features & Integrations</h3></EuiTitle>
              <EuiSpacer size="s" />
              <FeaturesIntegrations
                features={model.features}
                ilm={model.ilm}
                replication={model.replication}
                snapshots={model.snapshots}
                kibana={kibana ?? null}
              />
            </>
          )}

          <EuiSpacer size="l" />
          <EuiTitle size="s"><h3>Data Profile</h3></EuiTitle>
          <EuiSpacer size="s" />
          <DataProfile stats={model.stats} ilm={model.ilm} snapshots={model.snapshots} sizing={model.sizing} tierStorage={model.tierStorage} />

          {model.aiMl && (
            <>
              <EuiSpacer size="l" />
              <EuiTitle size="s"><h3>AI &amp; Machine Learning</h3></EuiTitle>
              <EuiSpacer size="s" />
              <AiMlSection aiMl={model.aiMl} features={model.features} />
            </>
          )}

          <EuiSpacer size="l" />
          <EuiTitle size="s"><h3>Index Landscape</h3></EuiTitle>
          <EuiSpacer size="s" />
          <IndexLandscape indices={model.indices} shards={model.shards} />

          {model.dataStreams.length > 0 && (
            <>
              <EuiSpacer size="l" />
              <EuiTitle size="s"><h3>Data Streams</h3></EuiTitle>
              <EuiSpacer size="s" />
              <DataStreams dataStreams={model.dataStreams} />
            </>
          )}

          {model.ingestPipelines.length > 0 && (
            <>
              <EuiSpacer size="l" />
              <EuiTitle size="s"><h3>Ingest Pipelines</h3></EuiTitle>
              <EuiSpacer size="s" />
              <IngestPipelines pipelines={model.ingestPipelines} />
            </>
          )}

          {model.replication && (model.replication.hasCCR || model.replication.remoteClusterCount > 0) && (
            <>
              <EuiSpacer size="l" />
              <EuiTitle size="s"><h3>Cross-Cluster</h3></EuiTitle>
              <EuiSpacer size="s" />
              <CrossCluster replication={model.replication} />
            </>
          )}

          {model.plugins.length > 0 && (
            <>
              <EuiSpacer size="l" />
              <EuiTitle size="s"><h3>Plugins</h3></EuiTitle>
              <EuiSpacer size="s" />
              <Plugins plugins={model.plugins} />
            </>
          )}

          {model.ilm && model.ilm.policies.length > 0 && (
            <>
              <EuiSpacer size="l" />
              <EuiTitle size="s"><h3>ILM Policies</h3></EuiTitle>
              <EuiSpacer size="s" />
              <ILMPoliciesTable policies={model.ilm.policies} />
            </>
          )}

          <EuiSpacer size="l" />
          <BestPractices />

          {notes && (
            <>
              <EuiSpacer size="l" />
              <EuiTitle size="s"><h3>Notes</h3></EuiTitle>
              <EuiSpacer size="s" />
              <EuiPanel paddingSize="m">
                <EuiText>
                  <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{notes}</p>
                </EuiText>
              </EuiPanel>
            </>
          )}

          <EuiSpacer size="xl" />
        </EuiPageBody>
      </EuiPage>
    </>
  )
}

export default App
