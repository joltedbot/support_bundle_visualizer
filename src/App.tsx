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
import Topology from './components/Topology'
import IndexLandscape from './components/IndexLandscape'
import FeaturesIntegrations from './components/FeaturesIntegrations'
import DataProfile from './components/DataProfile'
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

  const { model, customerName, clusterName, generatedAt, notes } = data
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
          <Overview model={model} />
          <EuiSpacer size="l" />
          <EuiTitle size="s">
            <h3>Topology</h3>
          </EuiTitle>
          <EuiSpacer size="s" />
          <Topology nodes={model.nodes} />
          <EuiSpacer size="l" />
          <EuiTitle size="s">
            <h3>Index Landscape</h3>
          </EuiTitle>
          <EuiSpacer size="s" />
          <IndexLandscape indices={model.indices} shards={model.shards} />
          <EuiSpacer size="l" />
          {model.features && (
            <>
              <EuiTitle size="s">
                <h3>Features & Integrations</h3>
              </EuiTitle>
              <EuiSpacer size="s" />
              <FeaturesIntegrations
                features={model.features}
                ml={model.ml}
                ilm={model.ilm}
                replication={model.replication}
                snapshots={model.snapshots}
              />
              <EuiSpacer size="l" />
            </>
          )}
          <EuiTitle size="s">
            <h3>Data Profile</h3>
          </EuiTitle>
          <EuiSpacer size="s" />
          <DataProfile stats={model.stats} ilm={model.ilm} snapshots={model.snapshots} />
          <EuiSpacer size="l" />
          <BestPractices />
          {notes && (
            <>
              <EuiSpacer size="l" />
              <EuiTitle size="s">
                <h3>Notes</h3>
              </EuiTitle>
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
