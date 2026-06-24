import { bundleData as data } from './generated/bundleData'
import {
  EuiPage,
  EuiPageBody,
  EuiEmptyPrompt,
  EuiText,
  EuiSpacer,
  EuiPanel,
} from '@elastic/eui'
import { Section } from './components/Section'
import ClusterHeader from './components/ClusterHeader'
import Overview from './components/Overview'
import InternalHealthSection from './components/InternalHealthSection'
import Licensing from './components/Licensing'
import Topology from './components/Topology'
import FeaturesIntegrations from './components/FeaturesIntegrations'
import FleetSection from './components/FleetSection'
import DataProfile, { ILMPoliciesTable, SLMPoliciesTable } from './components/DataProfile'
import SnapshotRepositories from './components/SnapshotRepositories'
import AiMlSection from './components/AiMlSection'
import IndexLandscape from './components/IndexLandscape'
import DataStreams from './components/DataStreams'
import IngestPipelines from './components/IngestPipelines'
import CrossCluster from './components/CrossCluster'
import Plugins from './components/Plugins'
import BestPractices from './components/BestPractices'

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

          {model.internalHealth && (
            <>
              <EuiSpacer size="l" />
              <InternalHealthSection internalHealth={model.internalHealth} />
            </>
          )}

          <Section title="Licensing" show={Boolean(model.license)}>
            <Licensing license={model.license!} />
          </Section>

          <Section title="Topology" show={true}>
            <Topology
              nodes={model.nodes}
              kibana={kibana ?? null}
              maxShardsPerNode={model.clusterSettings?.maxShardsPerNode ?? null}
              maxShardsPerNodeFrozen={model.clusterSettings?.maxShardsPerNodeFrozen ?? null}
            />
          </Section>

          <Section title="Features & Integrations" show={Boolean(model.features || kibana)}>
            <FeaturesIntegrations
              features={model.features}
              ilm={model.ilm}
              replication={model.replication}
              snapshots={model.snapshots}
              kibana={kibana ?? null}
            />
          </Section>

          <Section
            title="Fleet &amp; Elastic Agents"
            show={Boolean(kibana && (
              (kibana.fleet?.total ?? 0) > 0 ||
              kibana.fleetPolicies.some(p => !p.isPreconfigured) ||
              kibana.fleetSettings?.isConfigured
            ))}
          >
            <FleetSection kibana={kibana!} />
          </Section>

          <Section title="Data Profile" show={true}>
            <DataProfile stats={model.stats} ilm={model.ilm} snapshots={model.snapshots} sizing={model.sizing} tierStorage={model.tierStorage} />
          </Section>

          <Section title="AI &amp; Machine Learning" show={Boolean(model.aiMl)}>
            <AiMlSection aiMl={model.aiMl!} features={model.features} />
          </Section>

          <Section title="Indexes" show={true}>
            <IndexLandscape indices={model.indices} flaggedIndices={model.flaggedIndices} />
          </Section>

          <Section title="Data Streams" show={model.dataStreams.length > 0}>
            <DataStreams dataStreams={model.dataStreams} />
          </Section>

          <Section title="Ingest Pipelines" show={model.ingestPipelines.length > 0}>
            <IngestPipelines pipelines={model.ingestPipelines} />
          </Section>

          <Section
            title="Cross-Cluster"
            show={Boolean(model.replication && (model.replication.hasCCR || model.replication.remoteClusterCount > 0))}
          >
            <CrossCluster replication={model.replication!} />
          </Section>

          <Section title="Plugins" show={model.plugins.length > 0}>
            <Plugins plugins={model.plugins} />
          </Section>

          <Section title="ILM Policies" show={Boolean(model.ilm && model.ilm.policies.length > 0)}>
            <ILMPoliciesTable policies={model.ilm!.policies} />
          </Section>

          <Section title="Snapshot Repositories" show={Boolean(model.snapshots?.repositories.length)}>
            <SnapshotRepositories repositories={model.snapshots!.repositories} />
          </Section>

          <Section title="SLM Policies" show={Boolean(model.snapshots && model.snapshots.slmPolicies.length > 0)}>
            <SLMPoliciesTable policies={model.snapshots!.slmPolicies} />
          </Section>

          <EuiSpacer size="l" />
          <BestPractices />

          <Section title="Notes" show={Boolean(notes)}>
            <EuiPanel paddingSize="m">
              <EuiText>
                <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{notes}</p>
              </EuiText>
            </EuiPanel>
          </Section>

          <EuiSpacer size="xl" />
        </EuiPageBody>
      </EuiPage>
    </>
  )
}

export default App
