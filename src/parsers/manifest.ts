import { parseJsonFile, getTextFile } from '../utils/bundleReader'
import type { ClusterIdentity } from './types'

interface DiagnosticManifest {
  runner?: string
  version?: string
  timestamp?: string
  flags?: string
}

interface ManifestJson {
  runner?: string
  collectionDate?: string
  'Product Version'?: { version?: string }
}

interface NodesJson {
  nodes?: Record<string, {
    version?: string
    settings?: {
      cloud?: {
        region?: string
        provider?: string
      }
    }
  }>
}

interface VersionJson {
  version?: {
    number?: string
    lucene_version?: string
  }
}

/**
 * Parse region from cat_nodeattrs.txt.
 * Looks for rows with attr=availability_zone or attr=region to extract region.
 */
function parseRegionFromNodeAttrs(content: string): string | undefined {
  const lines = content.split('\n')
  // Skip header line
  for (const line of lines.slice(1)) {
    const parts = line.trim().split(/\s+/)
    if (parts.length < 5) continue
    const attr = parts[3]
    const value = parts[4]
    if (attr === 'region') {
      return value
    }
    if (attr === 'availability_zone') {
      // Extract region prefix: us-east-1a → us-east-1
      const match = value.match(/^([a-z]+-[a-z]+-\d+)[a-z]$/)
      if (match) return match[1]
      return value
    }
  }
  return undefined
}

/**
 * Parse cluster identity from diagnostic_manifest.json, manifest.json, nodes.json, version.json.
 * Returns null if no identity can be determined.
 */
export function parseManifest(files: Map<string, string>): ClusterIdentity | null {
  const diagManifest = parseJsonFile<DiagnosticManifest>(files, 'diagnostic_manifest.json')
  const manifestJson = parseJsonFile<ManifestJson>(files, 'manifest.json')
  const nodesJson = parseJsonFile<NodesJson>(files, 'nodes.json')
  const versionJson = parseJsonFile<VersionJson>(files, 'version.json')
  const nodeAttrsContent = getTextFile(files, 'cat/cat_nodeattrs.txt')

  // ES version: prefer diagnostic_manifest, then version.json, then manifest.json
  const esVersion =
    diagManifest?.version ??
    versionJson?.version?.number ??
    (manifestJson?.['Product Version'] as { version?: string } | undefined)?.version ??
    ''

  // Lucene version: from version.json
  const luceneVersion = versionJson?.version?.lucene_version ?? ''

  // Cluster name / UUID: from version.json (has cluster_name/cluster_uuid at top level)
  const versionJsonFull = parseJsonFile<{
    name?: string
    cluster_name?: string
    cluster_uuid?: string
    version?: { number?: string; lucene_version?: string }
  }>(files, 'version.json')

  const clusterName = versionJsonFull?.cluster_name ?? ''
  const clusterUUID = versionJsonFull?.cluster_uuid ?? ''

  // Collection timestamp
  const collectionTimestamp =
    diagManifest?.timestamp ??
    manifestJson?.collectionDate ??
    ''

  // Runner: normalize to uppercase-friendly string
  const rawRunner = diagManifest?.runner ?? manifestJson?.runner ?? ''
  const runner = rawRunner.toUpperCase()

  // Region from node settings or cat_nodeattrs
  let region: string | undefined
  let cloudProvider: string | undefined

  if (nodesJson?.nodes) {
    const firstNode = Object.values(nodesJson.nodes)[0]
    region = firstNode?.settings?.cloud?.region
    cloudProvider = firstNode?.settings?.cloud?.provider
  }

  if (!region && nodeAttrsContent) {
    region = parseRegionFromNodeAttrs(nodeAttrsContent)
  }

  // Try to extract region from the flags field (host URL) as fallback
  if (!region && diagManifest?.flags) {
    const match = diagManifest.flags.match(/\.([a-z]+-[a-z]+-\d+)\.aws\./)
    if (match) {
      region = match[1]
      if (!cloudProvider) cloudProvider = 'aws'
    }
  }

  // If we have no meaningful data at all, return null
  if (!clusterName && !esVersion && !collectionTimestamp) {
    return null
  }

  return {
    clusterName,
    clusterUUID,
    esVersion,
    luceneVersion,
    collectionTimestamp,
    runner,
    region,
    cloudProvider,
  }
}
