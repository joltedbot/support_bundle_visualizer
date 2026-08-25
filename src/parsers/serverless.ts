import { parseJsonFile } from '../utils/bundleReader'
import type { BundleModel, KibanaInfo, ServerlessCheck, ServerlessReadinessInfo } from './types'

// ── Constants ────────────────────────────────────────────────────────────────

const OFFICIAL_ES_PLUGINS = new Set([
  'analysis-icu', 'analysis-kuromoji', 'analysis-nori', 'analysis-phonetic',
  'analysis-smartcn', 'analysis-stempel', 'analysis-ukrainian',
  'discovery-azure-classic', 'discovery-ec2', 'discovery-gce',
  'mapper-annotated-text', 'mapper-murmur3', 'mapper-size',
  'repository-azure', 'repository-gcs', 'repository-hdfs', 'repository-s3',
  'store-smb',
])

const PLATFORM_REPOS = new Set(['found-snapshots'])
const PLATFORM_POLICIES = new Set(['cloud-snapshot-policy'])

// ── JSON shapes ──────────────────────────────────────────────────────────────

interface XpackJson {
  security?: { audit?: { enabled?: boolean; outputs?: string[] } }
  enterprise_search?: { search_applications?: { count?: number } }
}

interface ProfilingStatusJson {
  resources?: { has_data?: boolean }
}

type MappingProps = Record<string, { type?: string; properties?: MappingProps }>

interface MappingIndexEntry {
  mappings?: { properties?: MappingProps }
}

type AnalysisFilter = {
  type?: string
  synonyms?: unknown
  synonyms_path?: string
  synonyms_set?: string
}

interface SettingsIndexEntry {
  settings?: {
    index?: { analysis?: { filter?: Record<string, AnalysisFilter> } }
  }
}

interface ComponentTemplateItem {
  name?: string
  component_template?: {
    template?: {
      settings?: { analysis?: { filter?: Record<string, AnalysisFilter> } }
    }
  }
}

interface ComponentTemplatesJson {
  component_templates?: ComponentTemplateItem[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function hasJoinFieldInProps(props: MappingProps, depth = 0): boolean {
  if (depth > 10) return false
  for (const field of Object.values(props)) {
    if (!field || typeof field !== 'object') continue
    if (field.type === 'join') return true
    if (field.properties && hasJoinFieldInProps(field.properties, depth + 1)) return true
  }
  return false
}

function hasSynonymIssueInFilters(filters: Record<string, AnalysisFilter>): boolean {
  for (const filter of Object.values(filters)) {
    if (!filter || typeof filter !== 'object') continue
    const type = filter.type
    if (type !== 'synonym' && type !== 'synonym_graph') continue
    // synonyms_set is API-based and IS supported in Serverless
    if (filter.synonyms_set && !filter.synonyms && !filter.synonyms_path) continue
    // inline synonyms array or file-based path — both blocked
    if (filter.synonyms !== undefined || filter.synonyms_path) return true
  }
  return false
}

// ── Tier A checks (BundleModel only) ─────────────────────────────────────────

function checkILM(model: BundleModel): ServerlessCheck {
  const base = { key: 'ilm', label: 'Index Lifecycle Management (ILM)', category: 'observability' as const, severity: 'hard' as const }
  const ilm = model.ilm
  if (!ilm || ilm.managedIndexCount === 0) return { ...base, state: 'clear', detail: null }
  return { ...base, state: 'blocked', detail: `${ilm.managedIndexCount} managed indices across ${ilm.policyCount} ILM policies` }
}

function checkWatcher(model: BundleModel): ServerlessCheck {
  const base = { key: 'watcher', label: 'Watcher', category: 'elasticsearch' as const, severity: 'hard' as const }
  const features = model.features
  if (!features) return { ...base, state: 'unknown', detail: null }
  if (features.watcherCount > 0) return { ...base, state: 'blocked', detail: `${features.watcherCount} watches configured` }
  return { ...base, state: 'clear', detail: null }
}

function checkNativeRealm(model: BundleModel): ServerlessCheck {
  const base = { key: 'native-realm', label: 'Native Realm Authentication', category: 'core' as const, severity: 'hard' as const }
  const auth = model.auth
  if (!auth) return { ...base, state: 'unknown', detail: null }
  if (auth.nativeUserCount > 0) return { ...base, state: 'blocked', detail: `${auth.nativeUserCount} native user${auth.nativeUserCount > 1 ? 's' : ''}` }
  return { ...base, state: 'clear', detail: null }
}

function checkCustomPlugins(model: BundleModel): ServerlessCheck {
  const base = { key: 'custom-plugins', label: 'Custom Plugins & Bundles', category: 'core' as const, severity: 'hard' as const }
  const custom = model.plugins.filter(p => !OFFICIAL_ES_PLUGINS.has(p.component))
  if (custom.length === 0) return { ...base, state: 'clear', detail: null }
  return { ...base, state: 'blocked', detail: custom.map(p => p.component).join(', ') }
}

function checkCCR(model: BundleModel): ServerlessCheck {
  const base = { key: 'ccr', label: 'Cross-Cluster Replication', category: 'elasticsearch' as const, severity: 'planned' as const }
  const rep = model.replication
  if (!rep) return { ...base, state: 'unknown', detail: null }
  if (rep.hasCCR) return { ...base, state: 'blocked', detail: `${rep.followerIndexCount} follower index${rep.followerIndexCount !== 1 ? 'es' : ''}` }
  return { ...base, state: 'clear', detail: null }
}

function checkSnapshots(model: BundleModel): ServerlessCheck {
  const base = { key: 'snapshots', label: 'User-Initiated Snapshots / Restore', category: 'core' as const, severity: 'planned' as const }
  const snaps = model.snapshots
  if (!snaps) return { ...base, state: 'unknown', detail: null }
  const customerRepos = snaps.repositories.filter(r => !PLATFORM_REPOS.has(r.name))
  const customerPolicies = snaps.slmPolicies.filter(p => !PLATFORM_POLICIES.has(p.name))
  if (customerRepos.length === 0 && customerPolicies.length === 0) return { ...base, state: 'clear', detail: null }
  const parts: string[] = []
  if (customerRepos.length > 0) parts.push(`${customerRepos.length} custom repo${customerRepos.length > 1 ? 's' : ''}: ${customerRepos.map(r => r.name).join(', ')}`)
  if (customerPolicies.length > 0) parts.push(`${customerPolicies.length} SLM polic${customerPolicies.length > 1 ? 'ies' : 'y'}: ${customerPolicies.map(p => p.name).join(', ')}`)
  return { ...base, state: 'blocked', detail: parts.join('; ') }
}

function checkApmAgentCentralConfig(model: BundleModel): ServerlessCheck {
  const base = { key: 'apm-central-config', label: 'APM Agent Central Configuration', category: 'observability' as const, severity: 'hard' as const }
  const apmIndex = model.indices.find(i => i.name === '.apm-agent-configuration')
  if (!apmIndex) return { ...base, state: 'unknown', detail: null }
  if (apmIndex.docCount > 0) return { ...base, state: 'blocked', detail: `${apmIndex.docCount} agent configuration${apmIndex.docCount > 1 ? 's' : ''} stored` }
  return { ...base, state: 'clear', detail: null }
}

function checkDefendForContainers(kibana: KibanaInfo | null): ServerlessCheck {
  const base = { key: 'defend-for-containers', label: 'Defend for Containers', category: 'security' as const, severity: 'hard' as const }
  if (!kibana) return { ...base, state: 'unknown', detail: null }
  const pkg = kibana.fleetInstalledPackages.find(p => p.name === 'cloud_defend')
  if (pkg) return { ...base, state: 'blocked', detail: `cloud_defend ${pkg.version} installed` }
  return { ...base, state: 'clear', detail: null }
}

// ── Tier B checks (new file reads) ───────────────────────────────────────────

function checkAuditLogging(files: Map<string, string>): ServerlessCheck {
  const base = { key: 'audit-logging', label: 'Audit Logging', category: 'core' as const, severity: 'planned' as const }
  const xpack = parseJsonFile<XpackJson>(files, 'commercial/xpack.json')
  if (!xpack) return { ...base, state: 'unknown', detail: null }
  const audit = xpack.security?.audit
  if (!audit) return { ...base, state: 'unknown', detail: null }
  if (audit.enabled) {
    const outputs = audit.outputs?.join(', ') ?? 'unknown destination'
    return { ...base, state: 'blocked', detail: `Audit logging active (outputs: ${outputs})` }
  }
  return { ...base, state: 'clear', detail: null }
}

function checkSearchApplications(files: Map<string, string>): ServerlessCheck {
  const base = { key: 'search-applications', label: 'Search Applications (UI)', category: 'elasticsearch' as const, severity: 'hard' as const }
  const xpack = parseJsonFile<XpackJson>(files, 'commercial/xpack.json')
  if (!xpack) return { ...base, state: 'unknown', detail: null }
  const count = xpack.enterprise_search?.search_applications?.count
  if (count === undefined || count === null) return { ...base, state: 'unknown', detail: null }
  if (count > 0) return { ...base, state: 'blocked', detail: `${count} search application${count > 1 ? 's' : ''}` }
  return { ...base, state: 'clear', detail: null }
}

function checkUniversalProfiling(files: Map<string, string>): ServerlessCheck {
  const base = { key: 'universal-profiling', label: 'Universal Profiling', category: 'observability' as const, severity: 'hard' as const }
  const status = parseJsonFile<ProfilingStatusJson>(files, 'commercial/profiling_status.json')
  if (!status) return { ...base, state: 'unknown', detail: null }
  const hasData = status.resources?.has_data
  if (hasData === true) return { ...base, state: 'blocked', detail: 'Profiling data present on this cluster' }
  if (hasData === false) return { ...base, state: 'clear', detail: null }
  return { ...base, state: 'unknown', detail: null }
}

function checkJoinFields(files: Map<string, string>): ServerlessCheck {
  const base = { key: 'join-fields', label: 'Join Fields', category: 'elasticsearch' as const, severity: 'hard' as const }
  const mapping = parseJsonFile<Record<string, MappingIndexEntry>>(files, 'mapping.json')
  if (!mapping) return { ...base, state: 'unknown', detail: null }
  const affected: string[] = []
  for (const [indexName, entry] of Object.entries(mapping)) {
    const props = entry?.mappings?.properties
    if (props && hasJoinFieldInProps(props)) affected.push(indexName)
  }
  if (affected.length === 0) return { ...base, state: 'clear', detail: null }
  const preview = affected.slice(0, 3).join(', ') + (affected.length > 3 ? `… (+${affected.length - 3})` : '')
  return { ...base, state: 'blocked', detail: `${affected.length} index${affected.length > 1 ? 'es' : ''} with join fields: ${preview}` }
}

function checkSynonyms(files: Map<string, string>): ServerlessCheck {
  const base = { key: 'synonyms', label: 'Synonyms (Index-time or File-based)', category: 'elasticsearch' as const, severity: 'hard' as const }
  const settings = parseJsonFile<Record<string, SettingsIndexEntry>>(files, 'settings.json')
  const componentTemplates = parseJsonFile<ComponentTemplatesJson>(files, 'component_templates.json')
  if (!settings && !componentTemplates) return { ...base, state: 'unknown', detail: null }

  if (settings) {
    for (const entry of Object.values(settings)) {
      const filters = entry?.settings?.index?.analysis?.filter
      if (filters && hasSynonymIssueInFilters(filters)) {
        return { ...base, state: 'blocked', detail: 'Index-time or file-based synonym filters in use (Serverless supports API-based synonyms only)' }
      }
    }
  }

  if (componentTemplates) {
    for (const entry of componentTemplates.component_templates ?? []) {
      const filters = entry?.component_template?.template?.settings?.analysis?.filter
      if (filters && hasSynonymIssueInFilters(filters)) {
        return { ...base, state: 'blocked', detail: 'Index-time or file-based synonym filters in component templates (Serverless supports API-based synonyms only)' }
      }
    }
  }

  return { ...base, state: 'clear', detail: null }
}

// ── Tier C — always unknown ───────────────────────────────────────────────────

const TIER_C_CHECKS: ServerlessCheck[] = [
  { key: 'byo-key', label: 'BYO-Key Encryption at Rest', category: 'core', severity: 'planned', state: 'unknown', detail: null },
  { key: 'static-ips', label: 'Published Static IPs', category: 'core', severity: 'hard', state: 'unknown', detail: null },
  { key: 'es-hadoop', label: 'Elasticsearch for Apache Hadoop', category: 'elasticsearch', severity: 'hard', state: 'unknown', detail: null },
  { key: 'scripted-aggs', label: 'Scripted Metric Aggregations', category: 'elasticsearch', severity: 'hard', state: 'unknown', detail: null },
  { key: 'clone-index', label: 'Clone Index API', category: 'elasticsearch', severity: 'planned', state: 'unknown', detail: null },
  { key: 'apm-tail-sampling', label: 'APM Tail-based Sampling', category: 'observability', severity: 'hard', state: 'unknown', detail: null },
  { key: 'otel-central-config', label: 'Elastic OpenTelemetry Central Configuration', category: 'observability', severity: 'hard', state: 'unknown', detail: null },
  { key: 'serverless-forwarder', label: 'Elastic Serverless Forwarder', category: 'observability', severity: 'hard', state: 'unknown', detail: null },
  { key: 'rum', label: 'Real User Monitoring (RUM)', category: 'observability', severity: 'planned', state: 'unknown', detail: null },
]

// ── Main export ───────────────────────────────────────────────────────────────

export function parseServerlessReadiness(
  files: Map<string, string>,
  model: BundleModel,
  kibana: KibanaInfo | null
): ServerlessReadinessInfo {
  const checks: ServerlessCheck[] = [
    // Core (4)
    checkNativeRealm(model),
    checkCustomPlugins(model),
    checkSnapshots(model),
    checkAuditLogging(files),
    // Elasticsearch (7)
    checkWatcher(model),
    checkCCR(model),
    checkSearchApplications(files),
    checkJoinFields(files),
    checkSynonyms(files),
    // Observability (5)
    checkILM(model),
    checkApmAgentCentralConfig(model),
    checkUniversalProfiling(files),
    // Security (1)
    checkDefendForContainers(kibana),
    // Tier C — always unknown (9)
    ...TIER_C_CHECKS,
  ]
  return { checks }
}
