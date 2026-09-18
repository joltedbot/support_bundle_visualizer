// ── Metric availability vocabulary ───────────────────────────────────────────

export type UnavailableReason =
  | 'DATA_NOT_AVAILABLE'   // file missing or field not emitted
  | 'NOT_APPLICABLE'       // metric does not apply to this node/index type
  | 'REQUIRES_ES_8_17'     // allocations API only present in ES 8.17+
  | 'JOIN_FAILED'          // cross-entity join produced no match
  | 'COMPUTATION_GUARD'    // inputs present but guard triggered (e.g. uptime = 0)

export type Metric<T> = T | { unavailable: UnavailableReason }

export function isUnavailable<T>(m: Metric<T>): m is { unavailable: UnavailableReason } {
  return typeof m === 'object' && m !== null && 'unavailable' in (m as object)
}

// ── Per-node health signals (from nodes_stats.json) ───────────────────────────

export interface NodeWorkload {
  indexingPercent: number | null   // index_time_in_millis / uptime * 100; null = COMPUTATION_GUARD
  queryPercent: number | null
  mergePercent: number | null
  ingestPercent: number | null
}

export interface ThreadPoolStats {
  pool: string
  threads: number
  active: number
  queue: number
  rejected: number
  largest: number
}

export interface IndexingPressureStats {
  limitInBytes: number
  currentCoordinatingAndPrimaryInBytes: number
  currentReplicaInBytes: number
  totalRejectionsCoordinating: number
  totalRejectionsPrimary: number
  totalRejectionsReplica: number
  hasRejections: boolean
}

export interface CircuitBreakerStats {
  name: string
  tripped: number
  estimatedSizeInBytes: number
  limitSizeInBytes: number
}

export interface GCStats {
  youngCollectionCount: number
  youngCollectionTimeMs: number
  oldCollectionCount: number
  oldCollectionTimeMs: number
}

export interface AllocationForecast {
  undesiredShards: number
  forecastedDiskUsageInBytes: number
  forecastedIngestLoad: number
}

export interface NodeHealthSignals {
  nodeId: string
  nodeName: string
  workload: NodeWorkload | null                               // null for non-data nodes or uptime=0
  loadPercent: number | null                                  // load1m * 100 / allocatedProcessors; null when unreliable or unavailable
  loadPercentReliable: boolean                               // false on < 60 GB RAM (host-level metric unreliable on small VMs)
  indexingPressure: IndexingPressureStats | null
  threadPools: ThreadPoolStats[]                             // only pools with any data
  circuitBreakers: CircuitBreakerStats[]
  fielddataEvictions: number | null
  gc: GCStats | null
  allocations: AllocationForecast | Metric<null>             // Metric wraps NOT_APPLICABLE / REQUIRES_ES_8_17
}

// ── Pending tasks ─────────────────────────────────────────────────────────────

export interface PendingTask {
  insertOrder: number
  priority: string
  source: string
  timeInQueueMs: number  // negative values clamped to 0
}

export interface PendingTasksInfo {
  taskCount: number
  maxWaitMs: number
  tasks: PendingTask[]
}

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
  allocatedProcessors?: number  // os.allocated_processors — cgroup-aware vCPU count (Cloud); falls back to availableProcessors
  diskWatermark?: 'healthy' | 'low' | 'high' | 'flood' | null  // derived from diskUsedPercent; null for frozen nodes
  shardCount?: number       // total shards assigned to this node
  snapshotDataBytes?: number  // total dataset size of searchable snapshot shards on this node (frozen tier only)
  sharedCacheSizeBytes?: number  // pre-allocated shared snapshot cache size (frozen tier only)
  offHeapBytes?: number      // bytes of off-heap vector (HNSW) memory; absent when 0 or unavailable
  ramUsed?: number           // OS memory used in bytes (os.mem.used_in_bytes)
  jvmUptimeMs?: number       // JVM uptime in milliseconds (jvm.uptime_in_millis)
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
  avgShardSizeBytes: number
  ilmPolicy?: string  // policy name from ilm_explain.json, if managed
  models?: string[]   // names of embedding/reranking models used
  indexType?: 'index' | 'datastream-backing' | 'alias-backing'
  isLogsDb?: boolean  // true when index.mode=logsdb or mapping.source.mode=synthetic
}

export interface ShardInfo {
  index: string
  shard: number
  prirep: 'p' | 'r'
  state: string
  node?: string
  nodeId?: string       // resolved node ID from shard→node join; undefined when join fails
  storeSizeBytes: number
  datasetSizeBytes: number  // total dataset size incl. remote (searchable snapshot); equals storeSizeBytes for regular shards
  // Flags (primaries only — never set on replicas)
  oversized: boolean   // primary > 50 GiB
  undersized: boolean  // primary < 1 GiB (and not empty)
}

export interface ClusterStats {
  totalStoreSizeBytes: number
  totalDocCount: number
  avgDocSizeBytes: number
  searchQueryTotal: number
  fieldDataSizeBytes: number
  segmentCount: number
  deletedDocCount: number
}

export interface ILMPolicyDetail {
  name: string
  deleteDays: number | null       // delete phase min_age in days (retention)
  hotMaxAge: string | null        // hot rollover max_age raw (e.g. "30d")
  hotMaxSize: string | null       // hot rollover max_primary_shard_size raw (e.g. "50gb")
  warmMinAge: string | null       // warm phase min_age raw
  coldMinAge: string | null       // cold phase min_age raw
  frozenMinAge: string | null     // frozen phase min_age raw
  deleteMinAge: string | null     // delete phase min_age raw
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

export interface SLMPolicyDetail {
  name: string
  repository: string
  schedule: string
  retentionExpireAfter: string | null   // e.g. "8d"
  retentionMaxCount: number | null
  retentionMinCount: number | null
  lastSuccessDate: string | null        // ISO string
  lastFailureDate: string | null        // ISO string
  snapshotsTaken: number
  snapshotsFailed: number
  nextExecutionMillis: number | null    // when the next run is scheduled (epoch ms); null when absent
  overdue: boolean                      // true when nextExecutionMillis is in the past relative to collection time
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
  logstash: number
  activeInferenceEndpoints: string[]   // endpoint IDs referenced in mappings or pipelines
}

export interface RemoteCluster {
  name: string
  mode: string
  connected: boolean
  proxyAddress: string | null
  skipUnavailable: boolean
  socketConnections?: number
  maxSocketConnections?: number
}

export interface FollowerIndex {
  followerIndex: string
  remoteCluster: string
  leaderIndex: string
  status: string
}

export interface AutoFollowPattern {
  name: string
  remoteCluster: string
  leaderIndexPatterns: string[]
  followIndexPattern: string
}

export interface ReplicationInfo {
  hasCCR: boolean
  followerIndexCount: number
  remoteClusterCount: number
  remoteClusterNames: string[]
  remoteClusters: RemoteCluster[]
  followerIndices: FollowerIndex[]
  autoFollowPatterns: AutoFollowPattern[]
}

export interface SnapshotRepository {
  name: string
  type: string  // s3, gcs, azure, fs
  snapshotCount: number
  successCount: number
  failedCount: number
  settings: Record<string, string>
  lastSuccessfulSnapshotAgeMs: number | null  // ms since most recent SUCCESS snapshot; null when no successful snapshots
}

export interface SnapshotInfo {
  repositoryCount: number
  repositoryNames: string[]
  repositories: SnapshotRepository[]
  hasSLM: boolean
  slmPolicyCount: number
  slmPolicies: SLMPolicyDetail[]
  ilmOperationMode: string | null  // from commercial/ilm_status.json → operation_mode; null if file absent
  slmOperationMode: string | null  // from commercial/slm_status.json → operation_mode; null if file absent
}

export interface FleetAgentPolicy {
  name: string
  id: string
  agentCount: number
  isManaged: boolean
  isPreconfigured: boolean
  status: string
  updatedAt: string
  version: string
  packagePolicies: string[]  // names of integrations
}

export interface FleetPackage {
  name: string
  title: string
  version: string
  status: string
  policyNames: string[]
}

export interface KibanaInfo {
  version: string
  instanceName: string
  uuid: string
  status: 'green' | 'yellow' | 'red' | 'unknown'
  heapUsed?: number          // bytes
  heapTotal?: number         // bytes
  heapSizeLimit?: number     // bytes — V8 heap limit, corresponds to ESS instance size
  heapPercent?: number       // used / size_limit × 100, clamped 0–100
  eventLoopDelayMs?: number  // process.event_loop_delay ms
  uptimeMs?: number          // process.uptime_ms
  concurrentConnections?: number
  responseTimeAvgMs?: number
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
  fleetSettings: { fleetServerHosts: string[]; isConfigured: boolean } | null
  fleetPolicies: FleetAgentPolicy[]
  fleetInstalledPackages: FleetPackage[]
  synthetics: {
    projectCount: number
    monitorTypes: string[]
    locationCount: number
    tagCount: number
  } | null
  dataViews?: string[]  // titles of configured data views
}

export interface RetentionBucket {
  days: number
  policyCount: number
}

export interface IlmWindowRates {
  bulkBytesPerDay: number          // Σ write indices, raw pre-compression bytes through Bulk API
  indexingBytesPerDay: number      // Σ write indices, primary on-disk growth after compression
  compressionRatio: number | null  // bulk ÷ indexing; null when indexingBytesPerDay is 0
  writeIndexCount: number          // number of write indices that contributed a rate > 0
}

export interface SizingMetrics {
  avgQueryRateQPS: number | null     // avg QPS since last node restart
  nodeUptimeDays: number | null      // max uptime across nodes (context for QPS label)
  ingestRateGBPerDay: number | null  // estimated compressed primary GB/day (retention-based)
  bulkIngestRateBytesPerDay: number | null  // cumulative _source bytes written via bulk ÷ node uptime
  retentionDistribution: RetentionBucket[]  // sorted ascending by days
  primaryRetentionDays: number | null       // modal bucket's day value
  ilmWindowRates: IlmWindowRates | null     // esdiag ILM-window ingest and on-disk rates
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

export interface IdentityProvider {
  type: string  // 'saml' | 'active_directory' | 'ldap' | 'oidc' | 'native' | etc.
  name: string  // realm name (e.g. 'saml1')
  label: string  // human-friendly (e.g. 'Okta SAML', 'AD · cpr.ca')
}

export interface IdentityInfo {
  nativeUserCount: number  // non-reserved native users
  reservedUserCount: number
  providers: IdentityProvider[]
}

export interface PipelineInfo {
  name: string
  description?: string
  processorCount: number
  createdDate?: string
  metaPackageName?: string
  metaManaged?: boolean
  metaManagedBy?: string
}

export interface ClusterSettings {
  maxShardsPerNode: number | null
  maxShardsPerNodeFrozen: number | null
}

export interface HealthIndicator {
  status: 'green' | 'yellow' | 'red' | 'unknown'
  symptom: string
  details: Record<string, unknown> | null
}

export interface InternalHealth {
  overallStatus: string
  indicators: Record<string, HealthIndicator>
}

export type ServerlessCheckState = 'blocked' | 'clear' | 'unknown'

export interface ServerlessCheck {
  key: string
  label: string
  category: 'core' | 'elasticsearch' | 'observability' | 'security'
  severity: 'hard' | 'planned'
  state: ServerlessCheckState
  detail: string | null
}

export interface ServerlessReadinessInfo {
  checks: ServerlessCheck[]
}

export interface BundleModel {
  identity: ClusterIdentity | null
  health: ClusterHealth | null
  internalHealth: InternalHealth | null
  auth: IdentityInfo | null
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
  nodeHealthSignals: NodeHealthSignals[]
  pendingTasks: PendingTasksInfo | null
}

export interface GeneratedBundle {
  model: BundleModel | null
  customerName: string
  clusterName: string | null
  notes: string | null
  generatedAt: string | null
  hasKibanaBundle: boolean
  kibana: KibanaInfo | null
  serverlessReadiness: ServerlessReadinessInfo
}
