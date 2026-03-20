import React, { useState, useCallback } from 'react'
import {
  EuiPage,
  EuiPageBody,
  EuiEmptyPrompt,
  EuiButton,
  EuiText,
  EuiIcon,
  EuiSpacer,
  EuiTitle,
} from '@elastic/eui'
import { readBundleFromFileList, type BundleData } from './utils/bundleReader'
import { parseBundle, type BundleModel } from './parsers'
import ClusterHeader from './components/ClusterHeader'
import Overview from './components/Overview'
import Topology from './components/Topology'
import IndexLandscape from './components/IndexLandscape'
import ResourceHealth from './components/ResourceHealth'
import FeaturesIntegrations from './components/FeaturesIntegrations'
import DataProfile from './components/DataProfile'
import BestPractices from './components/BestPractices'

function App() {
  const [bundle, setBundle] = useState<BundleData | null>(null)
  const [model, setModel] = useState<BundleModel | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleFiles = useCallback(async (fileList: FileList) => {
    if (fileList.length === 0) return
    const data = await readBundleFromFileList(fileList)
    setBundle(data)
    const parsed = await parseBundle(data)
    setModel(parsed)
    console.log('Bundle model:', parsed)
  }, [])

  const handleReset = useCallback(() => {
    setBundle(null)
    setModel(null)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files)
      }
    },
    [handleFiles]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        handleFiles(e.target.files)
      }
    },
    [handleFiles]
  )

  if (bundle && model) {
    const hasResourceStats = model.nodes.some((n) => n.heapPercent !== undefined)

    return (
      <>
        <ClusterHeader model={model} bundleRootName={bundle.rootName} onReset={handleReset} />
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
            {hasResourceStats && (
              <>
                <EuiTitle size="s">
                  <h3>Resource Health</h3>
                </EuiTitle>
                <EuiSpacer size="s" />
                <ResourceHealth nodes={model.nodes} />
                <EuiSpacer size="l" />
              </>
            )}
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
          </EuiPageBody>
        </EuiPage>
      </>
    )
  }

  return (
    <EuiPage paddingSize="l">
      <EuiPageBody>
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          style={{
            border: `2px dashed ${isDragging ? '#36a2ef' : '#343741'}`,
            borderRadius: 8,
            padding: 64,
            textAlign: 'center',
            transition: 'border-color 0.2s',
            backgroundColor: isDragging ? 'rgba(54,162,239,0.05)' : undefined,
          }}
        >
          <EuiEmptyPrompt
            icon={<EuiIcon type="folderOpen" size="xxl" />}
            title={<h2>Drop a diagnostic bundle folder</h2>}
            body={
              <EuiText>
                <p>
                  Drag an <code>api-diagnostics-*</code> folder here, or browse to select it.
                </p>
              </EuiText>
            }
            actions={
              <>
                <label htmlFor="bundle-input">
                  <EuiButton fill>Browse for bundle folder</EuiButton>
                </label>
                <input
                  id="bundle-input"
                  type="file"
                  // @ts-expect-error webkitdirectory is non-standard
                  webkitdirectory=""
                  directory=""
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleFileInput}
                />
              </>
            }
          />
        </div>
      </EuiPageBody>
    </EuiPage>
  )
}

export default App
