import React, { useState, useCallback } from 'react'
import {
  EuiPage,
  EuiPageBody,
  EuiEmptyPrompt,
  EuiButton,
  EuiText,
  EuiIcon,
} from '@elastic/eui'
import { readBundleFromFileList, type BundleData } from './utils/bundleReader'

function App() {
  const [bundle, setBundle] = useState<BundleData | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleFiles = useCallback(async (fileList: FileList) => {
    if (fileList.length === 0) return
    const data = await readBundleFromFileList(fileList)
    setBundle(data)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.items) {
      // File System Access API drop — not available in all browsers
      // Fall back to dataTransfer.files
    }
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }, [handleFiles])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files)
    }
  }, [handleFiles])

  if (bundle) {
    return (
      <EuiPage paddingSize="l">
        <EuiPageBody>
          <EuiText>
            <h2>Bundle loaded: {bundle.rootName}</h2>
            <p>{bundle.files.size} files read</p>
          </EuiText>
        </EuiPageBody>
      </EuiPage>
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
                <p>Drag an <code>api-diagnostics-*</code> folder here, or browse to select it.</p>
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
