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
  instanceConfiguration?: string  // e.g. "aws.es.datahot.c6gd"
  // Resource stats (may be absent if nodes_stats not present)
  heapPercent?: number      // 0–100 (used heap / max heap)
  heapMaxBytes?: number     // bytes — max (allocated) JVM heap size (-Xmx)
  cpuPercent?: number       // 0–100
  diskUsedPercent?: number  // 0–100
  diskTotal?: number        // bytes
  diskAvail?: number        // bytes
  ramTotal?: number         // bytes
  availableProcessors?: number
  shardCount?: number       // total shards assigned to this node
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
  ilmPolicy?: string  // policy name from ilm_explain.json, if managed
  models?: string[]   // names of embedding/reranking models used
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

export interface ILMPolicyDetail {
  name: string
  deleteDays: number | null       // delete phase min_age in days (retention)
  hotMaxAge: string | null        // hot rollover max_age raw (e.g. "30d")
  hotMaxSize: string | null       // hot rollover max_primary_shard_size raw (e.g. "50gb")
  warmMinAge: string | null       // warm phase min_age raw
  coldMinAge: string | null       // cold phase min_age raw
  forceMergeSegments: number | null  // forcemerge max_num_segments
  shrinkShards: number | null     // shrink number_of_shards
  indexCount: number              // number of managed indices using this policy
}

export interface ILMInfo {
  policyCount: number
  managedIndexCount: number
  tiers: { hot: number; warm: number; cold: number; frozen: number }
  policies: ILMPolicyDetail[]
}

// ── AI / ML types ────────────────────────────────────────────────────────────

export type AnomalyJobState = 'opened' | 'closed' | 'failed' | 'opening' | 'closing'
export type MemoryStatus = 'ok' | 'soft_limit' | 'hard_limit'
export type DatafeedState = 'started' | 'stopped' | 'starting' | 'stopping'
export type JobOrigin = 'security' | 'observability' | 'apm' | 'user'
export type ModelClass = 'elser' | 'e5' | 'lang_ident' | 'nlp' | 'dfa'
export type DFAType = 'classification' | 'regression' | 'outlier_detection'

export interface AnomalyJob {
  jobId: string
  state: AnomalyJobState
  datafeedState: DatafeedState | null
  memoryStatus: MemoryStatus
  modelBytes: number
  processedRecordCount: number
  bucketCount: number
  origin: JobOrigin
  assignmentExplanation: string
}

export interface TrainedModel {
  modelId: string
  modelClass: ModelClass
  inferenceTask: string | null
  deployed: boolean
  deploymentState: 'started' | 'starting' | 'failed' | null
  allocationCount: number
  targetAllocationCount: number
  inferenceCount: number
  avgInferenceTimeMs: number | null
  licenseLevel: string
}

export interface DFAJob {
  id: string
  analysisType: DFAType
  state: string
}

export interface MLNodeMemory {
  nodeName: string
  maxBytes: number
  anomalyDetectorsBytes: number
  nativeInferenceBytes: number
  dataFrameAnalyticsBytes: number
}

export interface AIFeatures {
  hasSecurityAiAssistant: boolean
  hasObservabilityAiAssistant: boolean
  observabilityConversationCount: number
  hasChatAgents: boolean
  chatAgentCount: number
  chatConversationCount: number
  chatToolCount: number
  hasProductDocIndices: boolean
  productDocIndexCount: number
  inferenceEndpointCount: number        // from .inference index docCount
  mlInferenceStorageBytes: number       // from .ml-inference-native-* storeSizeBytes
}

export interface AiMlInfo {
  mlEnabled: boolean
  upgradeMode: boolean
  anomalyJobs: AnomalyJob[]
  trainedModels: TrainedModel[]         // includes lang_ident_model_1 — callers filter by modelClass
  dfaJobs: DFAJob[]
  mlNodeMemory: MLNodeMemory[]
  aiFeatures: AIFeatures
  // Populated in parsers/index.ts from the features mapping scan
  semanticTextIndexCount: number
  denseVectorIndexCount: number
  sparseVectorIndexCount: number
}

export interface DenseVectorDimGroup {
  dims: number
  count: number          // number of indices with this dim count
  inferenceId: string | null  // null = externally generated embeddings
  indexNames: string[]   // names of indices in this group
}

export interface FeatureInfo {
  solutionTypes: ('search' | 'observability' | 'security')[]
  hasVectorSearch: boolean        // dense_vector or sparse_vector fields
  hasSemanticText: boolean        // semantic_text fields
  hasGeoFields: boolean           // geo_point or geo_shape fields
  // semantic/vector index counts (from mapping scan)
  semanticTextIndexCount: number
  semanticTextIndexNames: string[]
  denseVectorIndexCount: number
  denseVectorDimGroups: DenseVectorDimGroup[]
  sparseVectorIndexCount: number
  sparseVectorIndexNames: string[]
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
  activeInferenceEndpoints: string[]   // endpoint IDs referenced in mappings or pipelines
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

export interface KibanaInfo {
  version: string
  instanceName: string
  uuid: string
  status: 'green' | 'yellow' | 'red' | 'unknown'
  heapUsed?: number          // bytes
  heapTotal?: number         // bytes
  heapSizeLimit?: number     // bytes — V8 heap limit, corresponds to ESS instance size
  alertingHealth: 'ok' | 'warn' | 'error' | null
  hasPermanentEncryptionKey: boolean | null
  taskManagerStatus: 'OK' | 'warn' | 'error' | null
  fleet: {
    total: number
    online: number
    offline: number
    error: number
    updating: number
    inactive: number
  } | null
  dataViews?: string[]  // titles of configured data views
}

export interface RetentionBucket {
  days: number
  policyCount: number
}

export interface SizingMetrics {
  avgQueryRateQPS: number | null     // avg QPS since last node restart
  nodeUptimeDays: number | null      // max uptime across nodes (context for QPS label)
  ingestRateGBPerDay: number | null  // estimated compressed primary GB/day (retention-based)
  retentionDistribution: RetentionBucket[]  // sorted ascending by days
  primaryRetentionDays: number | null       // modal bucket's day value
}

export interface LicenseInfo {
  status: string
  type: string
  issueDate: string | null
  expiryDate: string | null
  maxNodes: number | null
  maxResourceUnits: number | null
  issuedTo: string | null
  issuer: string | null
}

export interface PluginEntry {
  component: string
  version: string
}

export interface DataStreamInfo {
  name: string
  isSystem: boolean
  status: string
  indexCount: number
  ilmPolicy?: string
  lifecycle?: string   // data_retention value e.g. "90d"
  managedBy?: string   // next_generation_managed_by when not "Unmanaged"
}

export interface PipelineInfo {
  name: string
  description?: string
  createdDate?: string
  metaPackageName?: string
  metaManaged?: boolean
  metaManagedBy?: string
}

export interface ClusterSettings {
  maxShardsPerNode: number | null
  maxShardsPerNodeFrozen: number | null
}

export interface BundleModel {
  identity: ClusterIdentity | null
  health: ClusterHealth | null
  nodes: NodeInfo[]
  indices: IndexInfo[]
  shards: ShardInfo[]
  stats: ClusterStats | null
  ilm: ILMInfo | null
  aiMl: AiMlInfo | null
  features: FeatureInfo | null
  replication: ReplicationInfo | null
  snapshots: SnapshotInfo | null
  sizing: SizingMetrics | null
  license: LicenseInfo | null
  plugins: PluginEntry[]
  dataStreams: DataStreamInfo[]
  ingestPipelines: PipelineInfo[]
  clusterSettings: ClusterSettings | null
  tierStorage: Record<string, number> | null
}

export interface GeneratedBundle {
  model: BundleModel | null
  customerName: string
  clusterName: string | null
  notes: string | null
  generatedAt: string | null
  hasKibanaBundle: boolean
  kibana: KibanaInfo | null
}
