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
npm run generate -- --customer <dirname> --name "Name" [--cluster "Cluster"] [--notes "text"]
                         # Read bundle from diagnostics/<dirname>/, write src/generated/bundleData.ts
                         # Also writes src/generated/buildConfig.json used by vite.config.ts
                         # --cluster is optional; sets the cluster name in header and browser title
npm run build            # TypeScript check + Vite build → output/<dirname>/index.html (single inlined file)
npm run dev              # Dev server (requires bundleData.ts to exist — run generate first)
npx vitest run           # Run tests
```

## Project Structure

```
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
    DataProfile, IndexLandscape, DataStreams, CrossCluster, Plugins, BestPractices
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

**ClusterHeader**: Shows customer name and optional cluster name (passed via `--cluster` flag in generate command). Cluster name is displayed in normal font (not monospace). Omitted if null/empty.

**Overview**: Includes "Solution · Version" card showing solution type badges (Search/Observability/Security) + ES version + Kibana version (when Kibana bundle present); omitted if `features` is null or `solutionTypes` is empty.

**Licensing**: Shows license status, type, issue/expiry dates, max nodes/units, issuer, and issued-to organization. Omitted if license data absent.

**Topology**: Nodes grouped by availability zone (alphabetically, "Unknown AZ" last) when AZ data available; falls back to tier grouping. Each AZ section shows node count and tier breakdown. Summary bar at top shows all non-zero tier counts. Each NodeCard displays vCPU count (from `available_processors`), RAM, disk capacity in the format `"32 vCPU · 61.0 GiB RAM · 1.4 TiB disk"`, and `instanceConfiguration` below the capacity line. Role badges on their own line below node name (10px font, wrapping). Node sort order: master > ml > ingest > transform > coordinating > hot > warm > cold > frozen. Kibana section rendered below ES nodes when Kibana bundle present.

**FeaturesIntegrations**: `features` prop is nullable. Kibana health badges (alerting, task manager) rendered when Kibana data present. Fleet badge rendered only when `fleet.total > 0`. Data views section shows Kibana data views as badges when present.

**DataStreams**: Paginated table (default 10/page) with system-streams toggle. Shows name, isSystem flag, status, index count, ILM policy, and managedBy field. Omitted if no data streams present.

**CrossCluster**: Displays CCR/CCS configuration details. Rendered only when cross-cluster replication or search is configured.

**Plugins**: Unique installed plugins table, deduplicated by component name with version. Omitted if no plugins present.

**IndexLandscape**: Paginated index table (default 10/page). Shows indices, shards, replicas, size, docs, health, ILM policy.

## Utilities

**nodeRoles.ts** exports:
- `getNodeSortPriority(role: string): number` — return sort order for a role
- `sortNodesByRole(nodes: Node[]): Node[]` — sort nodes by role priority
- `groupNodesByAZ(nodes: Node[]): Record<string, Node[]>` — group nodes by AZ
- `buildSummaryBar(nodes: Node[]): SummaryEntry[]` — tier counts for the summary bar
- `SummaryEntry` interface: `{ tier: string; count: number }`

See `src/utils/nodeRoles.test.ts` for test coverage.

## Kibana Bundle Support

`generate.ts` detects `kibana-api-diagnostics-*/` alongside the ES bundle and calls `parseKibana()`. The `KibanaInfo` object is stored as `GeneratedBundle.kibana` (null when absent).

**Important**: use `heap.size_limit` from `kibana_status.json` for the Kibana instance size — not OS RAM, which reflects the shared ESS host machine and is misleading (shows 60GB on a 1GB instance).

## Reference Bundles

`diagnostics/Hinge/` — gitignored, available locally.
Hinge (dating app): 21 nodes (3 master + 18 hot), 117 indices, ES 9.3.1, AWS us-east-1. Kibana bundle also present.
Run: `npm run generate -- --customer Hinge --name "Hinge" --cluster "Hinge Prod"`

`diagnostics/FI.Span/` — gitignored, available locally. Kibana bundle also present.
Run: `npm run generate -- --customer "FI.Span" --name "FI.Span"`
