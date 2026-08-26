import { describe, it, expect } from 'vitest'
import { parseServerlessReadiness } from './serverless'
import type { BundleModel, KibanaInfo } from './types'

// Minimal BundleModel factory — only set the fields each check uses
function makeModel(overrides: Partial<BundleModel> = {}): BundleModel {
  return {
    identity: null,
    health: null,
    internalHealth: null,
    auth: null,
    nodes: [],
    indices: [],
    shards: [],
    stats: null,
    ilm: null,
    aiMl: null,
    features: null,
    replication: null,
    snapshots: null,
    sizing: null,
    license: null,
    plugins: [],
    dataStreams: [],
    ingestPipelines: [],
    clusterSettings: null,
    tierStorage: null,
    ...overrides,
  }
}

// Minimal files Map factory
function makeFiles(entries: Record<string, unknown> = {}): Map<string, string> {
  const m = new Map<string, string>()
  for (const [k, v] of Object.entries(entries)) {
    m.set(k, JSON.stringify(v))
  }
  return m
}

function check(result: ReturnType<typeof parseServerlessReadiness>, key: string) {
  const c = result.checks.find(c => c.key === key)
  if (!c) throw new Error(`Check "${key}" not found`)
  return c
}

// ── ILM ──────────────────────────────────────────────────────────────────────

describe('ILM check', () => {
  it('blocked when managed indices exist', () => {
    const model = makeModel({ ilm: { policyCount: 5, managedIndexCount: 42, tiers: { hot: 10, warm: 20, cold: 12, frozen: 0 }, policies: [] } })
    const r = parseServerlessReadiness(new Map(), model, null)
    const c = check(r, 'ilm')
    expect(c.state).toBe('blocked')
    expect(c.detail).toContain('42')
  })

  it('clear when no managed indices', () => {
    const model = makeModel({ ilm: { policyCount: 5, managedIndexCount: 0, tiers: { hot: 0, warm: 0, cold: 0, frozen: 0 }, policies: [] } })
    const r = parseServerlessReadiness(new Map(), model, null)
    expect(check(r, 'ilm').state).toBe('clear')
  })

  it('unknown when ilm is null', () => {
    const r = parseServerlessReadiness(new Map(), makeModel(), null)
    expect(check(r, 'ilm').state).toBe('unknown')
  })
})

// ── Watcher ───────────────────────────────────────────────────────────────────

describe('Watcher check', () => {
  it('blocked when watcherCount > 0', () => {
    const model = makeModel({ features: { watcherCount: 7, hasWatcher: true, solutionTypes: [], hasVectorSearch: false, hasSemanticText: false, hasGeoFields: false, semanticTextIndexCount: 0, semanticTextIndexNames: [], denseVectorIndexCount: 0, denseVectorDimGroups: [], sparseVectorIndexCount: 0, sparseVectorIndexNames: [], hasML: false, hasILM: false, hasCCR: false, hasCCS: false, hasIngestPipelines: false, hasTransforms: false, hasEnrich: false, ingestPipelineCount: 0, transformCount: 0, enrichPolicyCount: 0, logstash: 0, activeInferenceEndpoints: [] } })
    const r = parseServerlessReadiness(new Map(), model, null)
    const c = check(r, 'watcher')
    expect(c.state).toBe('blocked')
    expect(c.detail).toContain('7')
  })

  it('clear when watcherCount is 0', () => {
    const model = makeModel({ features: { watcherCount: 0, hasWatcher: false, solutionTypes: [], hasVectorSearch: false, hasSemanticText: false, hasGeoFields: false, semanticTextIndexCount: 0, semanticTextIndexNames: [], denseVectorIndexCount: 0, denseVectorDimGroups: [], sparseVectorIndexCount: 0, sparseVectorIndexNames: [], hasML: false, hasILM: false, hasCCR: false, hasCCS: false, hasIngestPipelines: false, hasTransforms: false, hasEnrich: false, ingestPipelineCount: 0, transformCount: 0, enrichPolicyCount: 0, logstash: 0, activeInferenceEndpoints: [] } })
    const r = parseServerlessReadiness(new Map(), model, null)
    expect(check(r, 'watcher').state).toBe('clear')
  })

  it('unknown when features is null', () => {
    const r = parseServerlessReadiness(new Map(), makeModel(), null)
    expect(check(r, 'watcher').state).toBe('unknown')
  })
})

// ── Native realm ──────────────────────────────────────────────────────────────

describe('Native realm check', () => {
  it('blocked when native users exist', () => {
    const model = makeModel({ auth: { nativeUserCount: 3, reservedUserCount: 5, providers: [] } })
    const r = parseServerlessReadiness(new Map(), model, null)
    const c = check(r, 'native-realm')
    expect(c.state).toBe('blocked')
    expect(c.detail).toContain('3')
  })

  it('clear when nativeUserCount is 0', () => {
    const model = makeModel({ auth: { nativeUserCount: 0, reservedUserCount: 5, providers: [] } })
    expect(check(parseServerlessReadiness(new Map(), model, null), 'native-realm').state).toBe('clear')
  })

  it('unknown when auth is null', () => {
    expect(check(parseServerlessReadiness(new Map(), makeModel(), null), 'native-realm').state).toBe('unknown')
  })
})

// ── Custom plugins ─────────────────────────────────────────────────────────────

describe('Custom plugins check', () => {
  it('blocked when non-allowlist plugin present', () => {
    const model = makeModel({ plugins: [{ component: 'my-custom-plugin', version: '1.0.0' }] })
    const r = parseServerlessReadiness(new Map(), model, null)
    const c = check(r, 'custom-plugins')
    expect(c.state).toBe('blocked')
    expect(c.detail).toContain('my-custom-plugin')
  })

  it('clear when only official plugins and both analysis files available', () => {
    const model = makeModel({ plugins: [{ component: 'analysis-icu', version: '9.3.0' }, { component: 'repository-s3', version: '9.3.0' }] })
    const files = makeFiles({ 'settings.json': {}, 'component_templates.json': { component_templates: [] } })
    expect(check(parseServerlessReadiness(files, model, null), 'custom-plugins').state).toBe('clear')
  })

  it('clear when plugins list is empty and both analysis files available', () => {
    const files = makeFiles({ 'settings.json': {}, 'component_templates.json': { component_templates: [] } })
    expect(check(parseServerlessReadiness(files, makeModel(), null), 'custom-plugins').state).toBe('clear')
  })

  it('unknown with Partial Data when analysis files not available', () => {
    const c = check(parseServerlessReadiness(new Map(), makeModel(), null), 'custom-plugins')
    expect(c.state).toBe('unknown')
    expect(c.detail).toContain('Partial Data')
  })

  it('unknown with Partial Data when only settings.json available (component_templates missing)', () => {
    const files = makeFiles({ 'settings.json': {} })
    const c = check(parseServerlessReadiness(files, makeModel(), null), 'custom-plugins')
    expect(c.state).toBe('unknown')
    expect(c.detail).toContain('Partial Data')
    expect(c.detail).toContain('component_templates.json')
  })

  it('blocked with Partial Data prefix when custom plugin found but analysis files missing', () => {
    const model = makeModel({ plugins: [{ component: 'my-custom-plugin', version: '1.0.0' }] })
    const c = check(parseServerlessReadiness(new Map(), model, null), 'custom-plugins')
    expect(c.state).toBe('blocked')
    expect(c.detail).toContain('Partial Data')
    expect(c.detail).toContain('my-custom-plugin')
  })

  it('blocked when stopwords_path in settings.json', () => {
    const files = makeFiles({
      'settings.json': {
        'my-index': {
          settings: {
            index: {
              analysis: {
                filter: {
                  my_stop: { type: 'stop', stopwords_path: 'analysis/stopwords.txt' },
                },
              },
            },
          },
        },
      },
    })
    const c = check(parseServerlessReadiness(files, makeModel(), null), 'custom-plugins')
    expect(c.state).toBe('blocked')
    expect(c.detail).toContain('file-based')
  })

  it('blocked when user_dictionary in settings.json', () => {
    const files = makeFiles({
      'settings.json': {
        'my-index': {
          settings: {
            index: {
              analysis: {
                tokenizer: {
                  my_kuromoji: { type: 'kuromoji_tokenizer', user_dictionary: 'userdict_ja.txt' },
                },
              },
            },
          },
        },
      },
    })
    const c = check(parseServerlessReadiness(files, makeModel(), null), 'custom-plugins')
    expect(c.state).toBe('blocked')
  })

  it('clear when settings only has synonyms_path and both analysis files available', () => {
    const files = makeFiles({
      'settings.json': {
        'my-index': {
          settings: {
            index: {
              analysis: {
                filter: {
                  syn: { type: 'synonym', synonyms_path: 'analysis/synonyms.txt' },
                },
              },
            },
          },
        },
      },
      'component_templates.json': { component_templates: [] },
    })
    // synonyms_path is excluded from custom-plugins check; both files present → clear
    const c = check(parseServerlessReadiness(files, makeModel(), null), 'custom-plugins')
    expect(c.state).toBe('clear')
  })
})

// ── CCR ───────────────────────────────────────────────────────────────────────

describe('CCR check', () => {
  it('blocked when hasCCR', () => {
    const model = makeModel({ replication: { hasCCR: true, followerIndexCount: 3, remoteClusterCount: 1, remoteClusterNames: ['remote-1'], remoteClusters: [], followerIndices: [], autoFollowPatterns: [] } })
    const c = check(parseServerlessReadiness(new Map(), model, null), 'ccr')
    expect(c.state).toBe('blocked')
    expect(c.detail).toContain('3')
  })

  it('clear when no CCR', () => {
    const model = makeModel({ replication: { hasCCR: false, followerIndexCount: 0, remoteClusterCount: 0, remoteClusterNames: [], remoteClusters: [], followerIndices: [], autoFollowPatterns: [] } })
    expect(check(parseServerlessReadiness(new Map(), model, null), 'ccr').state).toBe('clear')
  })

  it('unknown when replication is null', () => {
    expect(check(parseServerlessReadiness(new Map(), makeModel(), null), 'ccr').state).toBe('unknown')
  })
})

// ── Snapshots ─────────────────────────────────────────────────────────────────

describe('Snapshots check', () => {
  it('clear when only found-snapshots repo + cloud-snapshot-policy', () => {
    const model = makeModel({
      snapshots: {
        repositoryCount: 1, repositoryNames: ['found-snapshots'],
        repositories: [{ name: 'found-snapshots', type: 'gcs', snapshotCount: 30, successCount: 30, failedCount: 0, settings: {} }],
        hasSLM: true, slmPolicyCount: 1,
        slmPolicies: [{ name: 'cloud-snapshot-policy', repository: 'found-snapshots', schedule: '0 30 * * * ?', retentionExpireAfter: null, retentionMaxCount: null, retentionMinCount: null, lastSuccessDate: null, lastFailureDate: null, snapshotsTaken: 100, snapshotsFailed: 0 }],
      }
    })
    expect(check(parseServerlessReadiness(new Map(), model, null), 'snapshots').state).toBe('clear')
  })

  it('blocked when customer repo exists', () => {
    const model = makeModel({
      snapshots: {
        repositoryCount: 2, repositoryNames: ['found-snapshots', 'my-backup'],
        repositories: [
          { name: 'found-snapshots', type: 'gcs', snapshotCount: 30, successCount: 30, failedCount: 0, settings: {} },
          { name: 'my-backup', type: 's3', snapshotCount: 5, successCount: 5, failedCount: 0, settings: {} },
        ],
        hasSLM: true, slmPolicyCount: 1,
        slmPolicies: [{ name: 'cloud-snapshot-policy', repository: 'found-snapshots', schedule: '0 30 * * * ?', retentionExpireAfter: null, retentionMaxCount: null, retentionMinCount: null, lastSuccessDate: null, lastFailureDate: null, snapshotsTaken: 100, snapshotsFailed: 0 }],
      }
    })
    const c = check(parseServerlessReadiness(new Map(), model, null), 'snapshots')
    expect(c.state).toBe('blocked')
    expect(c.detail).toContain('my-backup')
  })

  it('blocked when customer SLM policy exists alongside cloud policy', () => {
    const model = makeModel({
      snapshots: {
        repositoryCount: 1, repositoryNames: ['found-snapshots'],
        repositories: [{ name: 'found-snapshots', type: 'gcs', snapshotCount: 30, successCount: 30, failedCount: 0, settings: {} }],
        hasSLM: true, slmPolicyCount: 2,
        slmPolicies: [
          { name: 'cloud-snapshot-policy', repository: 'found-snapshots', schedule: '0 30 * * * ?', retentionExpireAfter: null, retentionMaxCount: null, retentionMinCount: null, lastSuccessDate: null, lastFailureDate: null, snapshotsTaken: 100, snapshotsFailed: 0 },
          { name: 'my-hourly-snapshots', repository: 'found-snapshots', schedule: '0 0 * * * ?', retentionExpireAfter: '30d', retentionMaxCount: null, retentionMinCount: null, lastSuccessDate: null, lastFailureDate: null, snapshotsTaken: 48, snapshotsFailed: 0 },
        ],
      }
    })
    const c = check(parseServerlessReadiness(new Map(), model, null), 'snapshots')
    expect(c.state).toBe('blocked')
    expect(c.detail).toContain('my-hourly-snapshots')
  })

  it('unknown when snapshots is null', () => {
    expect(check(parseServerlessReadiness(new Map(), makeModel(), null), 'snapshots').state).toBe('unknown')
  })
})

// ── APM Agent Central Config ──────────────────────────────────────────────────

describe('APM Agent Central Config check', () => {
  it('blocked when .apm-agent-configuration has docs', () => {
    const model = makeModel({ indices: [{ name: '.apm-agent-configuration', isSystem: true, health: 'green', status: 'open', primaryShards: 1, replicaShards: 1, docCount: 12, storeSizeBytes: 1000, avgShardSizeBytes: 1000 }] })
    const c = check(parseServerlessReadiness(new Map(), model, null), 'apm-central-config')
    expect(c.state).toBe('blocked')
    expect(c.detail).toContain('12')
  })

  it('clear when .apm-agent-configuration has 0 docs', () => {
    const model = makeModel({ indices: [{ name: '.apm-agent-configuration', isSystem: true, health: 'green', status: 'open', primaryShards: 1, replicaShards: 1, docCount: 0, storeSizeBytes: 498, avgShardSizeBytes: 498 }] })
    expect(check(parseServerlessReadiness(new Map(), model, null), 'apm-central-config').state).toBe('clear')
  })

  it('unknown when index not present', () => {
    expect(check(parseServerlessReadiness(new Map(), makeModel(), null), 'apm-central-config').state).toBe('unknown')
  })
})

// ── Defend for Containers ─────────────────────────────────────────────────────

describe('Defend for Containers check', () => {
  it('blocked when cloud_defend installed', () => {
    const kibana = { fleetInstalledPackages: [{ name: 'cloud_defend', title: 'Defend for Containers', version: '1.2.0', status: 'installed', policyNames: [] }] } as unknown as KibanaInfo
    const c = check(parseServerlessReadiness(new Map(), makeModel(), kibana), 'defend-for-containers')
    expect(c.state).toBe('blocked')
    expect(c.detail).toContain('1.2.0')
  })

  it('clear when cloud_defend not in installed packages list', () => {
    const kibana = { fleetInstalledPackages: [{ name: 'apm', title: 'APM', version: '8.0.0', status: 'installed', policyNames: [] }] } as unknown as KibanaInfo
    expect(check(parseServerlessReadiness(new Map(), makeModel(), kibana), 'defend-for-containers').state).toBe('clear')
  })

  it('unknown when no kibana bundle', () => {
    expect(check(parseServerlessReadiness(new Map(), makeModel(), null), 'defend-for-containers').state).toBe('unknown')
  })
})

// ── Audit logging (xpack.json) ────────────────────────────────────────────────

describe('Audit logging check', () => {
  it('blocked when security.audit.enabled is true', () => {
    const files = makeFiles({ 'commercial/xpack.json': { security: { audit: { enabled: true, outputs: ['logfile'] } } } })
    const c = check(parseServerlessReadiness(files, makeModel(), null), 'audit-logging')
    expect(c.state).toBe('blocked')
    expect(c.detail).toContain('logfile')
  })

  it('clear when audit.enabled is false', () => {
    const files = makeFiles({ 'commercial/xpack.json': { security: { audit: { enabled: false } } } })
    expect(check(parseServerlessReadiness(files, makeModel(), null), 'audit-logging').state).toBe('clear')
  })

  it('unknown when xpack.json is absent', () => {
    expect(check(parseServerlessReadiness(new Map(), makeModel(), null), 'audit-logging').state).toBe('unknown')
  })
})

// ── Search Applications ───────────────────────────────────────────────────────

describe('Search applications check', () => {
  it('blocked when count > 0', () => {
    const files = makeFiles({ 'commercial/xpack.json': { enterprise_search: { search_applications: { count: 4 } } } })
    const c = check(parseServerlessReadiness(files, makeModel(), null), 'search-applications')
    expect(c.state).toBe('blocked')
    expect(c.detail).toContain('4')
  })

  it('clear when count is 0', () => {
    const files = makeFiles({ 'commercial/xpack.json': { enterprise_search: { search_applications: { count: 0 } } } })
    expect(check(parseServerlessReadiness(files, makeModel(), null), 'search-applications').state).toBe('clear')
  })

  it('unknown when xpack.json absent', () => {
    expect(check(parseServerlessReadiness(new Map(), makeModel(), null), 'search-applications').state).toBe('unknown')
  })
})

// ── Universal Profiling ───────────────────────────────────────────────────────

describe('Universal Profiling check', () => {
  it('blocked when resources.has_data is true', () => {
    const files = makeFiles({ 'commercial/profiling_status.json': { profiling: { enabled: true }, resources: { has_data: true } } })
    const c = check(parseServerlessReadiness(files, makeModel(), null), 'universal-profiling')
    expect(c.state).toBe('blocked')
  })

  it('clear when resources.has_data is false (even if profiling.enabled is true)', () => {
    const files = makeFiles({ 'commercial/profiling_status.json': { profiling: { enabled: true }, resources: { has_data: false } } })
    expect(check(parseServerlessReadiness(files, makeModel(), null), 'universal-profiling').state).toBe('clear')
  })

  it('unknown when profiling_status.json absent', () => {
    expect(check(parseServerlessReadiness(new Map(), makeModel(), null), 'universal-profiling').state).toBe('unknown')
  })
})

// ── Join fields ───────────────────────────────────────────────────────────────

describe('Join fields check', () => {
  it('blocked when mapping has a join type field', () => {
    const files = makeFiles({
      'mapping.json': {
        'my-index': {
          mappings: {
            properties: {
              my_join: { type: 'join', relations: { question: 'answer' } },
            },
          },
        },
      },
    })
    const c = check(parseServerlessReadiness(files, makeModel(), null), 'join-fields')
    expect(c.state).toBe('blocked')
    expect(c.detail).toContain('my-index')
  })

  it('clear when no join types in mapping', () => {
    const files = makeFiles({
      'mapping.json': {
        'my-index': {
          mappings: { properties: { title: { type: 'text' }, count: { type: 'integer' } } },
        },
      },
    })
    expect(check(parseServerlessReadiness(files, makeModel(), null), 'join-fields').state).toBe('clear')
  })

  it('unknown when mapping.json absent', () => {
    expect(check(parseServerlessReadiness(new Map(), makeModel(), null), 'join-fields').state).toBe('unknown')
  })
})

// ── Synonyms ──────────────────────────────────────────────────────────────────

describe('Synonyms check', () => {
  it('blocked when index settings has inline synonym filter', () => {
    const files = makeFiles({
      'settings.json': {
        'my-index': {
          settings: {
            index: {
              analysis: {
                filter: {
                  my_synonyms: { type: 'synonym', synonyms: ['foo, bar'] },
                },
              },
            },
          },
        },
      },
    })
    expect(check(parseServerlessReadiness(files, makeModel(), null), 'synonyms').state).toBe('blocked')
  })

  it('blocked when index settings has synonym_graph with synonyms_path', () => {
    const files = makeFiles({
      'settings.json': {
        'my-index': {
          settings: {
            index: {
              analysis: {
                filter: {
                  path_filter: { type: 'synonym_graph', synonyms_path: 'analysis/synonyms.txt' },
                },
              },
            },
          },
        },
      },
    })
    expect(check(parseServerlessReadiness(files, makeModel(), null), 'synonyms').state).toBe('blocked')
  })

  it('clear when only synonyms_set (API-based, supported in Serverless) and both files available', () => {
    const files = makeFiles({
      'settings.json': {
        'my-index': {
          settings: {
            index: {
              analysis: {
                filter: {
                  api_synonyms: { type: 'synonym', synonyms_set: 'my-synonym-set' },
                },
              },
            },
          },
        },
      },
      'component_templates.json': { component_templates: [] },
    })
    expect(check(parseServerlessReadiness(files, makeModel(), null), 'synonyms').state).toBe('clear')
  })

  it('blocked when component_templates has inline synonym filter', () => {
    const files = makeFiles({
      'component_templates.json': {
        component_templates: [
          {
            name: 'my-template',
            component_template: {
              template: {
                settings: {
                  analysis: {
                    filter: {
                      my_syn: { type: 'synonym', synonyms: ['foo => bar'] },
                    },
                  },
                },
              },
            },
          },
        ],
      },
    })
    expect(check(parseServerlessReadiness(files, makeModel(), null), 'synonyms').state).toBe('blocked')
  })

  it('clear when settings.json has no analysis block and both files available', () => {
    const files = makeFiles({
      'settings.json': { 'my-index': { settings: { index: { number_of_shards: '1' } } } },
      'component_templates.json': { component_templates: [] },
    })
    expect(check(parseServerlessReadiness(files, makeModel(), null), 'synonyms').state).toBe('clear')
  })

  it('unknown when both settings.json and component_templates.json absent', () => {
    expect(check(parseServerlessReadiness(new Map(), makeModel(), null), 'synonyms').state).toBe('unknown')
  })

  it('unknown with Partial Data when only settings.json available (no blocker found)', () => {
    const files = makeFiles({ 'settings.json': { 'my-index': { settings: { index: { number_of_shards: '1' } } } } })
    const c = check(parseServerlessReadiness(files, makeModel(), null), 'synonyms')
    expect(c.state).toBe('unknown')
    expect(c.detail).toContain('Partial Data')
    expect(c.detail).toContain('component_templates.json')
  })

  it('blocked with Partial Data prefix when blocker in settings but component_templates missing', () => {
    const files = makeFiles({
      'settings.json': {
        'my-index': {
          settings: { index: { analysis: { filter: { my_syn: { type: 'synonym', synonyms: ['foo, bar'] } } } } },
        },
      },
    })
    const c = check(parseServerlessReadiness(files, makeModel(), null), 'synonyms')
    expect(c.state).toBe('blocked')
    expect(c.detail).toContain('Partial Data')
    expect(c.detail).toContain('component_templates.json')
  })

  it('blocked with Partial Data prefix when blocker in component_templates but settings missing', () => {
    const files = makeFiles({
      'component_templates.json': {
        component_templates: [{
          name: 'my-template',
          component_template: {
            template: { settings: { analysis: { filter: { my_syn: { type: 'synonym', synonyms: ['foo => bar'] } } } } },
          },
        }],
      },
    })
    const c = check(parseServerlessReadiness(files, makeModel(), null), 'synonyms')
    expect(c.state).toBe('blocked')
    expect(c.detail).toContain('Partial Data')
    expect(c.detail).toContain('settings.json')
  })
})

// ── Tier C always-unknown checks ──────────────────────────────────────────────

describe('Always-unknown checks', () => {
  const alwaysUnknown = [
    'byo-key', 'static-ips', 'es-hadoop', 'scripted-aggs',
    'apm-tail-sampling', 'otel-central-config', 'serverless-forwarder',
    'rum', 'clone-index',
  ]
  for (const key of alwaysUnknown) {
    it(`${key} is always unknown`, () => {
      expect(check(parseServerlessReadiness(new Map(), makeModel(), null), key).state).toBe('unknown')
    })
  }
})

// ── Result structure ──────────────────────────────────────────────────────────

describe('Result structure', () => {
  it('returns exactly 22 checks', () => {
    const r = parseServerlessReadiness(new Map(), makeModel(), null)
    expect(r.checks).toHaveLength(22)
  })

  it('all checks have required fields', () => {
    const r = parseServerlessReadiness(new Map(), makeModel(), null)
    for (const c of r.checks) {
      expect(c.key).toBeTruthy()
      expect(c.label).toBeTruthy()
      expect(['core', 'elasticsearch', 'observability', 'security']).toContain(c.category)
      expect(['hard', 'planned']).toContain(c.severity)
      expect(['blocked', 'clear', 'unknown']).toContain(c.state)
    }
  })
})
