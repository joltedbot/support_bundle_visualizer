# Bundle Visualizer

Local React web app for Elastic SAs to quickly orient on a customer cluster from an Elasticsearch diagnostic bundle.

## Workflow

The app has no browser file picker. Data is baked in at build time:

1. SA places bundle(s) in `diagnostics/<customer>/`
2. SA tells Claude Code: "Read and execute the instructions in GENERATE.md"
3. Claude asks questions, runs `npm run generate`, then `npm run build`
4. SA opens `output/<dirname>/index.html` — no server needed

## Setup

Install with `--legacy-peer-deps` due to React 19 / @elastic/charts peer dependency conflict:

```bash
npm install --legacy-peer-deps
```

## Commands

```bash
pnpm run generate -- --customer <dirname> --name "Name" [--cluster "Cluster"] [--notes "text"]
                         # Read bundle from diagnostics/<dirname>/, write src/generated/bundleData.ts
                         # Auto-detects single vs multi-deployment layout
                         # Multi-deployment: generates + builds all deployments automatically
                         # --cluster is optional; ignored for multi-deployment (uses dir names)
pnpm run build           # TypeScript check + Vite build → output/<dirname>/index.html (single inlined file)
npm run dev              # Dev server (requires bundleData.ts to exist — run generate first)
npx vitest run           # Run tests
```

## Project Structure

```
public/
  favicon.svg       # Elastic logo favicon, copied to each output build
scripts/
  generate.ts       # Node.js generator: reads bundle from disk → src/generated/bundleData.ts
src/
  generated/
    bundleData.ts   # AUTO-GENERATED — gitignored, contains customer data, never commit
    buildConfig.json  # AUTO-GENERATED — gitignored, tells vite.config.ts the output dir
  parsers/          # Bundle file parsers → typed BundleModel
    types.ts        # All shared TypeScript interfaces (incl. GeneratedBundle, KibanaInfo)
    index.ts        # parseBundle() orchestrator (ES bundle)
    kibana.ts       # parseKibana() — reads Kibana diagnostic bundle
    license.ts, plugins.ts, datastreams.ts  # License, plugins, data streams
    manifest.ts, health.ts, nodes.ts, indices.ts, shards.ts,
    stats.ts, ilm.ts, ml.ts, features.ts, replication.ts, snapshots.ts
  components/       # UI sections (one file per section)
    ClusterHeader, Overview, Licensing, Topology, FeaturesIntegrations,
    DataProfile, AiMlSection, IndexLandscape, DataStreams, CrossCluster, Plugins, BestPractices
  utils/
    bundleReader.ts  # BundleData interface + parseJsonFile / getTextFile helpers
    format.ts        # formatBytes, formatCount, healthColor, resourceColor
    nodeRoles.ts     # Node role sorting, AZ grouping, role utilities
docs/
  superpowers/      # Design specs and implementation plans
    specs/
    plans/
GENERATE.md         # SA/Claude workflow instructions — read this to run a generate
```

## Build Output

Build via `vite-plugin-singlefile` produces a single self-contained HTML file (~2MB) with all CSS and JavaScript inlined. This is required because ES module `type="module"` scripts fail to load via `file://` protocol (CORS restriction). The output file can be opened directly in a browser without a server.

## Testing

`vitest` is configured in `vite.config.ts`. Import `defineConfig` from `vitest/config` (not `vite`) to include the `test:` config block without TypeScript errors.

## Key Conventions

- **UI**: @elastic/eui components only, dark theme (`colorMode="dark"` on EuiProvider)
- **Missing data**: skip silently — no "N/A", no "data not available" banners. If a section has no data, don't render it.
- **Defensive parsers**: all parsers return null/empty on missing or malformed files, never throw
- **Git**: user handles all commits — never run `git commit` or `git push`
- **Generated data**: `src/generated/bundleData.ts` and `src/generated/buildConfig.json` are gitignored — never commit them
- **Docs**: design specs and implementation plans stored in `docs/superpowers/` — not part of build output

## Component Notes

**ClusterHeader**: Shows customer name, optional cluster name (passed via `--cluster` flag in generate command), collection timestamp, and generated timestamp. Cluster name is displayed in normal font (not monospace). Omitted if null/empty. Deployment type/region info has moved to the Overview card row.

**Overview**: Stats card row. Card order: Cluster health → Deployment → Solution → Total nodes → User indices → Active shards → Total store size → Total documents → Avg doc size. Both Deployment and Solution use a custom layout (not EuiStat) with a plain `size="s"` label at top (no subdued color, to match Cluster health). **Deployment card**: `runner: "cli"` → label "Deployment" + bold "Self-Hosted"; `runner: "ess"` → label "Deployment" + bold "AWS · us-east-1" + bold "ECH" below; omitted when runner absent. **Solution card**: label "Solution" + solution badge(s) (Search/Observability/Security) + bold "ES v{version}" + bold "Kibana v{version}" (when Kibana present); omitted if `features` is null or `solutionTypes` is empty. All bold text is `size="s"` strong.

**Licensing**: Shows license status, type, issue/expiry dates, max nodes/units, issuer, and issued-to organization. Omitted if license data absent.

**Topology**: Nodes grouped by availability zone (alphabetically, "Unknown AZ" last) when AZ data available; falls back to tier grouping. Each AZ section shows node count and tier breakdown. Summary bar at top shows all non-zero tier counts. Each NodeCard displays vCPU count (from `available_processors`), RAM, disk capacity in the format `"32 vCPU · 61.0 GiB RAM · 1.4 TiB disk"`, and `instanceConfiguration` below the capacity line. Three resource gauges: "JVM Heap Used" (heap_used_percent), "JVM Heap / RAM" (heapMaxBytes / ramTotal %, with bytes displayed; green ≤50%, yellow 51–55%, red ≥56%), and "Disk Used" (diskUsedPercent). CPU gauge also present. Gauges render only when their source data is present. Role badges on their own line below node name (10px font, wrapping). Node sort order: master > ml > ingest > transform > coordinating > hot > warm > cold > frozen. Kibana section rendered below ES nodes when Kibana bundle present.

**FeaturesIntegrations**: `features` prop is nullable. Kibana health badges (alerting, task manager) rendered when Kibana data present. Fleet badge rendered only when `fleet.total > 0`. Data views section shows Kibana data views as badges when present.

**DataProfile**: Summary panels (Data Profile, ILM & Tiering, Snapshots, Sizing Estimates) with full-width ILM Policies table below. The ILM summary card (tier counts, policy count) remains in DataProfile; the full ILM Policies table is now a separate top-level section after Plugins.

**AiMlSection**: AI & Machine Learning content (anomaly detection, trained models, DFA, ML node memory, semantic search, AI features). Positioned between DataProfile and IndexLandscape. Omitted if no ML/AI data present. Semantic Search panel shows dense_vector fields grouped by `(dims, inferenceId)` composite key. Each group displays index count, source label (inference model name or "External" for field-level embeddings), and known model hints (e.g., 1536 dims → OpenAI ada-002, 384 → E5-small). Dense vector dims and inference model are resolved via three-step fallback: (1) field-level `inference_id`, (2) index `default_pipeline` → pipeline's `inference` processor `model_id`, (3) null (External).

**DataStreams**: Paginated table (default 10/page) with system-streams toggle. Shows name, isSystem flag, status, index count, ILM policy, and managedBy field. Omitted if no data streams present.

**CrossCluster**: Displays CCR/CCS configuration details. Rendered only when cross-cluster replication or search is configured.

**Plugins**: Unique installed plugins table, deduplicated by component name with version. Omitted if no plugins present.

**IndexLandscape**: Paginated index table (default 10/page). Shows indices, shards, replicas, size, docs, health, ILM policy.

## Parsers: Technical Details

**manifest.ts** — Cluster identity and region detection:
- `parseClusterIdentity()` orchestrates region detection with a three-tier fallback: (1) node settings (`cloud.region`, `cloud.provider` from nodes.json), (2) cat_nodeattrs.txt AZ parsing, (3) host URL parsing from `manifest.json` diagnosticInputs or diagnostic_manifest.json flags
- `parseRegionFromHostUrl()` extracts region and cloud provider from ESS host URLs: AWS (`*.region.aws.found.io`), Azure (`*.region.azure.elastic-cloud.com`), GCP (`*.region.gcp.cloud.es.io`)
- `parseRegionFromNodeAttrs()` parses availability_zone and region attributes from cat_nodeattrs.txt, handling AWS AZ format (`us-east-1a` → `us-east-1`) and Azure AZ format (`eastus2-1` → `eastus2`)
- Previously only AWS regions were detected from host URLs; Azure and GCP cloud deployments now correctly show region in Deployment card

**features.ts** — Dense vector and semantic text scanning:
- `scanMappingProperties()` scans all index mappings and returns arrays of dense_vector, semantic_text, and sparse_vector fields with dims and inference_id per field
- `parseFeatures()` groups dense_vector indices by `(dims, inferenceId)` composite key, enabling per-dim breakdown in SemanticSearchPanel showing index count and source (model name or "External")

## Utilities

**nodeRoles.ts** exports:
- `getNodeSortPriority(role: string): number` — return sort order for a role
- `sortNodesByRole(nodes: Node[]): Node[]` — sort nodes by role priority
- `groupNodesByAZ(nodes: Node[]): Record<string, Node[]>` — group nodes by AZ
- `buildSummaryBar(nodes: Node[]): SummaryEntry[]` — tier counts for the summary bar
- `SummaryEntry` interface: `{ tier: string; count: number }`

See `src/utils/nodeRoles.test.ts` for test coverage.

## Bundle Types

The tool supports two types of Elasticsearch diagnostic bundles:

- **Cloud (ESS)**: folder named `api-diagnostics-YYYYMMDD-HHMMSS/`. May include a Kibana bundle (`kibana-api-diagnostics-*/`). Manifest has `"runner": "ess"`.
- **Self-hosted**: folder named `local-diagnostics-YYYYMMDD-HHMMSS/`. Kibana bundles are uncommon for self-hosted deployments. Manifest has `"runner": "cli"`.

Both bundle types have identical internal file structure, so all parsers work with both. `generate.ts` auto-detects the bundle type and folder naming.

## Multi-Deployment Customers

Some customers have multiple deployments. Their directory structure has an extra level:

```
diagnostics/<customer>/
  <deployment-1>/
    api-diagnostics-YYYYMMDD-HHMMSS/
    kibana-api-diagnostics-YYYYMMDD-HHMMSS/
  <deployment-2>/
    api-diagnostics-YYYYMMDD-HHMMSS/
```

`generate.ts` auto-detects this layout. For multi-deployment customers, the script generates and builds all deployments in one run. Each deployment's cluster name is derived from its directory name (hyphens replaced with spaces). Output goes to `output/<customer>/<deployment>/index.html`.

## Kibana Bundle Support

`generate.ts` detects `kibana-api-diagnostics-*/` alongside the ES bundle and calls `parseKibana()`. The `KibanaInfo` object is stored as `GeneratedBundle.kibana` (null when absent).

**Important**: use `heap.size_limit` from `kibana_status.json` for the Kibana instance size — not OS RAM, which reflects the shared ESS host machine and is misleading (shows 60GB on a 1GB instance).

## Reference Bundles

`diagnostics/Hinge/` — gitignored, available locally.
Hinge (dating app): 21 nodes (3 master + 18 hot), 117 indices, ES 9.3.1, AWS us-east-1. Kibana bundle also present.
Run: `pnpm run generate -- --customer Hinge --name "Hinge" --cluster "Hinge Prod"`

`diagnostics/FI.Span/` — gitignored, available locally. Kibana bundle also present.
Run: `pnpm run generate -- --customer "FI.Span" --name "FI.Span"`

`diagnostics/Presidents Choice Financial/` — gitignored, available locally. Self-hosted bundle, no Kibana.
Run: `pnpm run generate -- --customer "Presidents Choice Financial" --name "Presidents Choice Financial"`

`diagnostics/ADA Support/` — gitignored, available locally. Multi-deployment customer.
ADA Support: 3 deployments (airflow-azure-eastus2-production_us2, api-azure-centralus-dev_us1, api-azure-eastus2-production_us2).
Run: `pnpm run generate -- --customer "ADA Support" --name "ADA Support"`
