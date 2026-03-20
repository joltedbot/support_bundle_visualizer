export interface ClusterIdentity {
  clusterName: string
  clusterUUID: string
  esVersion: string
  luceneVersion: string
  collectionTimestamp: string  // ISO string
  runner: string               // e.g. "ESS"
  region?: string
  cloudProvider?: string
}

export interface ClusterHealth {
  status: 'green' | 'yellow' | 'red' | 'unknown'
  numberOfNodes: number
  numberOfDataNodes: number
  activePrimaryShards: number
  activeShards: number
  relocatingShards: number
  initializingShards: number
  unassignedShards: number
  activeShardsPercent: number
}

export type NodeRole =
  | 'master'
  | 'data_hot'
  | 'data_warm'
  | 'data_cold'
  | 'data_frozen'
  | 'ingest'
  | 'coordinating'
  | 'ml'
  | 'transform'
  | 'remote_cluster_client'

export interface NodeInfo {
  id: string
  name: string
  ip: string
  roles: NodeRole[]
  tier: 'master' | 'hot' | 'warm' | 'cold' | 'frozen' | 'coordinating' | 'mixed'
  az?: string
  // Resource stats (may be absent if nodes_stats not present)
  heapPercent?: number      // 0–100
  cpuPercent?: number       // 0–100
  diskUsedPercent?: number  // 0–100
  diskTotal?: number        // bytes
  diskAvail?: number        // bytes
  ramTotal?: number         // bytes
  availableProcessors?: number
}

export interface IndexInfo {
  name: string
  isSystem: boolean   // name starts with "."
  health: 'green' | 'yellow' | 'red' | 'unknown'
  status: 'open' | 'close'
  primaryShards: number
  replicaShards: number
  docCount: number
  storeSizeBytes: number
}

export interface ShardInfo {
  index: string
  shard: number
  prirep: 'p' | 'r'
  state: string
  node?: string
  storeSizeBytes: number
  // Flags
  oversized: boolean   // > 50GB
  undersized: boolean  // < 1GB (and not empty)
}

export interface ClusterStats {
  totalStoreSizeBytes: number
  totalDocCount: number
  avgDocSizeBytes: number
  searchQueryTotal: number
  fieldDataSizeBytes: number
  segmentCount: number
}

export interface ILMInfo {
  policyCount: number
  managedIndexCount: number
  tiers: { hot: number; warm: number; cold: number; frozen: number }
}

export interface MLInfo {
  enabled: boolean
  anomalyDetectionJobCount: number
  trainedModelCount: number
  memoryUsageBytes: number
}

export interface FeatureInfo {
  solutionTypes: ('search' | 'observability' | 'security')[]
  hasVectorSearch: boolean        // dense_vector or sparse_vector fields
  hasSemanticText: boolean        // semantic_text fields
  hasGeoFields: boolean           // geo_point or geo_shape fields
  hasML: boolean
  hasILM: boolean
  hasCCR: boolean
  hasCCS: boolean
  hasIngestPipelines: boolean
  hasWatcher: boolean
  hasTransforms: boolean
  hasEnrich: boolean
  ingestPipelineCount: number
  watcherCount: number
  transformCount: number
  enrichPolicyCount: number
}

export interface ReplicationInfo {
  hasCCR: boolean
  followerIndexCount: number
  remoteClusterCount: number
  remoteClusterNames: string[]
}

export interface SnapshotInfo {
  repositoryCount: number
  repositoryNames: string[]
  hasSLM: boolean
  slmPolicyCount: number
}

export interface BundleModel {
  identity: ClusterIdentity | null
  health: ClusterHealth | null
  nodes: NodeInfo[]
  indices: IndexInfo[]
  shards: ShardInfo[]
  stats: ClusterStats | null
  ilm: ILMInfo | null
  ml: MLInfo | null
  features: FeatureInfo | null
  replication: ReplicationInfo | null
  snapshots: SnapshotInfo | null
}

export interface GeneratedBundle {
  model: BundleModel | null
  customerName: string
  clusterName: string | null
  notes: string | null
  generatedAt: string | null
  hasKibanaBundle: boolean
}
