import { describe, it, expect } from 'vitest'
import { parseBundle } from './index'
import type { IndexInfo, NodeInfo } from './types'
import { parseManifest } from './manifest'
import { parseHealth } from './health'
import { parseInternalHealth } from './internalHealth'
import { parseAuth } from './auth'
import { parseNodes, buildNodeHealthSignals } from './nodes'
import { parseIndices } from './indices'
import { parseIndexTraits } from './indexTraits'
import { parseShards } from './shards'
import { parseStats } from './stats'
import { parseILM, buildIndexPolicyMap } from './ilm'
import { buildIndexModelMap } from './indexModels'
import { parseML } from './ml'
import { parseFeatures } from './features'
import { parseReplication } from './replication'
import { parseSnapshots } from './snapshots'
import { parseSizing } from './sizing'
import { parseLicense } from './license'
import { parsePlugins } from './plugins'
import { parseDataStreams } from './datastreams'
import { parsePipelines } from './pipelines'
import { parseClusterSettings } from './clusterSettings'
import { parsePendingTasks } from './pendingTasks'
import { parseInferenceEndpoints } from './inference'

// Every file name the parsers read. Keep in sync when a parser starts reading a new file.
const FILE_NAMES = [
  'alias.json', 'cluster_state.json', 'cat/cat_indices.txt', 'cat/cat_nodeattrs.txt', 'cat/cat_nodes.txt', 'cat/cat_shards.txt',
  'cluster_health.json', 'cluster_pending_tasks.json', 'cluster_settings.json', 'cluster_stats.json',
  'commercial/ccr_autofollow_patterns.json', 'commercial/ccr_follower_info.json', 'commercial/ccr_stats.json',
  'commercial/data_stream.json', 'commercial/enrich_policies.json', 'commercial/ilm_explain.json',
  'commercial/ilm_policies.json', 'commercial/ilm_status.json', 'commercial/logstash_pipeline.json',
  'commercial/ml_anomaly_detectors.json', 'commercial/ml_datafeeds_stats.json', 'commercial/ml_datafeeds.json',
  'commercial/ml_dataframe_stats.json', 'commercial/ml_dataframe.json', 'commercial/ml_info.json',
  'commercial/ml_memory_stats.json', 'commercial/ml_stats.json', 'commercial/ml_trained_models_stats.json',
  'commercial/ml_trained_models.json', 'commercial/profiling_status.json',
  'commercial/searchable_snapshots_cache_stats.json', 'commercial/security_users.json',
  'commercial/slm_policies.json', 'commercial/slm_status.json', 'commercial/transform.json',
  'commercial/watcher_stats.json', 'commercial/xpack.json', 'component_templates.json',
  'diagnostic_manifest.json', 'indices_stats.json', 'internal_health.json', 'licenses.json', 'manifest.json',
  'mapping.json', 'nodes_stats.json', 'nodes.json', 'pipelines.json', 'plugins.json',
  'remote_cluster_info.json', 'repositories.json', 'settings.json', 'snapshot.json', 'version.json',
]

// Valid JSON (or text) of the wrong shape: the case JSON.parse alone does not catch.
const PAYLOADS = [
  '', 'null', '[]', '{}', '"text"', '42', 'true', '[null]', '{"a":null}', '[1,"x",null]',
  '{"nodes":null}', '{"nodes":{"n1":null}}', '{"nodes":[null]}', '{"stats":42}', '{"indices":null}',
  '{"x":{"aliases":null}}', '{"x":null}',
  '{"nodes":{"n1":{"thread_pool":{"write":null},"breakers":{"parent":null},"jvm":null,"os":null,"indices":null}}}',
  '{"nodes":{"n1":{"name":null,"roles":"data","settings":null}}}',
  '{"stats":[null]}', '{"snapshots":[null]}', '{"trained_model_stats":[null],"jobs":[null],"datafeeds":[null]}',
  '{"n1":{"mappings":{"properties":{"f":null,"g":{"properties":null}}}}}', 'not json at all', 'index shard\nnull null',
]

// Called directly: parseBundle wraps these in safe(), which would hide a throwing parser.
const STUB_NODE = {
  id: 'n1', name: 'node-1', ip: '', roles: ['data_hot'], tier: 'hot',
} as unknown as NodeInfo
const STUB_INDEX = {
  name: 'idx', isSystem: false, health: 'green', status: 'open', primaryShards: 1, replicaShards: 0,
  docCount: 1, storeSizeBytes: 1, primaryStoreSizeBytes: 1, avgShardSizeBytes: 1,
  ilmPolicy: null, models: [], indexType: 'index', indexMode: null, syntheticSource: false, vector: null,
} as IndexInfo

const PARSERS: Array<[string, (files: Map<string, string>) => unknown]> = [
  ['parseManifest', parseManifest],
  ['parseHealth', parseHealth],
  ['parseInternalHealth', parseInternalHealth],
  ['parseAuth', parseAuth],
  ['parseNodes', parseNodes],
  ['buildNodeHealthSignals', f => buildNodeHealthSignals(f, [STUB_NODE])],
  ['parseIndices', f => parseIndices(f, new Set())],
  ['parseIndexTraits', parseIndexTraits],
  ['parseShards', parseShards],
  ['parseStats', parseStats],
  ['parseILM', parseILM],
  ['buildIndexPolicyMap', buildIndexPolicyMap],
  ['buildIndexModelMap', buildIndexModelMap],
  ['parseML', f => parseML(f, [STUB_INDEX])],
  ['parseFeatures', f => parseFeatures(f, [STUB_INDEX])],
  ['parseReplication', parseReplication],
  ['parseSnapshots', f => parseSnapshots(f, null)],
  ['parseSizing', f => parseSizing(f, [STUB_INDEX])],
  ['parseLicense', parseLicense],
  ['parsePlugins', parsePlugins],
  ['parseDataStreams', parseDataStreams],
  ['parsePipelines', parsePipelines],
  ['parseClusterSettings', parseClusterSettings],
  ['parsePendingTasks', parsePendingTasks],
  ['parseInferenceEndpoints', f => parseInferenceEndpoints(f, ['x'])],
]

describe('individual parsers never throw on wrong-shaped input', () => {
  for (const [name, parser] of PARSERS) {
    it(name, () => {
      for (const payload of PAYLOADS) {
        const allFiles = new Map(FILE_NAMES.map(file => [file, payload]))
        expect(() => parser(allFiles), `${name} with all files = ${JSON.stringify(payload)}`).not.toThrow()
        for (const file of FILE_NAMES) {
          expect(() => parser(new Map([[file, payload]])), `${name} with ${file} = ${JSON.stringify(payload)}`).not.toThrow()
        }
      }
    })
  }
})

describe('parseBundle fallbacks', () => {
  it('returns empty/null shapes for wrong-shaped files', async () => {
    const files = new Map([['manifest.json', '[]'], ['nodes.json', 'null']])
    const model = await parseBundle({ files, rootName: 'fuzz' })
    expect(Array.isArray(model.nodes)).toBe(true)
    expect(Array.isArray(model.indices)).toBe(true)
    expect(model.identity).toBeNull()
  })

  it('tolerates null entries in alias.json', async () => {
    const files = new Map([['alias.json', '{"x":null,"y":{"aliases":null}}']])
    const model = await parseBundle({ files, rootName: 'fuzz' })
    expect(model).toBeDefined()
  })
})

describe('parseBundle never throws on wrong-shaped input', () => {
  for (const payload of PAYLOADS) {
    it(`all files = ${JSON.stringify(payload)}`, async () => {
      const files = new Map(FILE_NAMES.map(name => [name, payload]))
      await expect(parseBundle({ files, rootName: 'fuzz' })).resolves.toBeDefined()
    })
  }

  it('survives each file individually holding every payload', async () => {
    for (const name of FILE_NAMES) {
      for (const payload of PAYLOADS) {
        const files = new Map([[name, payload]])
        await expect(parseBundle({ files, rootName: 'fuzz' })).resolves.toBeDefined()
      }
    }
  })
})
