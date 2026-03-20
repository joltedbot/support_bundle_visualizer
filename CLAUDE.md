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
npm run generate -- --customer <dirname> --name "Name" [--notes "text"]
                         # Read bundle from diagnostics/<dirname>/, write src/generated/bundleData.ts
                         # Also writes src/generated/buildConfig.json used by vite.config.ts
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
    types.ts        # All shared TypeScript interfaces (incl. GeneratedBundle)
    index.ts        # parseBundle() orchestrator
    manifest.ts, health.ts, nodes.ts, indices.ts, shards.ts,
    stats.ts, ilm.ts, ml.ts, features.ts, replication.ts, snapshots.ts
  components/       # UI sections (one file per section)
    ClusterHeader, Overview, Topology, IndexLandscape,
    ResourceHealth, FeaturesIntegrations, DataProfile, BestPractices
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

**ClusterHeader**: Shows customer name and cluster name (from `model.identity?.clusterName` in monospace; omitted if null/empty).

**Overview**: Includes "Solution · Version" card showing solution type badges (Search/Observability/Security) + ES version; omitted if `features` is null or `solutionTypes` is empty.

**Topology**: Nodes grouped by availability zone (alphabetically, "Unknown AZ" last) when AZ data available; falls back to tier grouping. Each AZ section shows node count and tier breakdown. Summary bar at top shows all non-zero tier counts. Each NodeCard shows RAM + disk capacity; node sort order: master > ml > ingest > transform > coordinating > hot > warm > cold > frozen.

## Utilities

**nodeRoles.ts** exports:
- `getNodeSortPriority(role: string): number` — return sort order for a role
- `sortNodesByRole(nodes: Node[]): Node[]` — sort nodes by role priority
- `groupNodesByAZ(nodes: Node[]): Record<string, Node[]>` — group nodes by AZ
- `buildSummaryBar(nodes: Node[]): SummaryEntry[]` — tier counts for the summary bar
- `SummaryEntry` interface: `{ tier: string; count: number }`

See `src/utils/nodeRoles.test.ts` for test coverage.

## Reference Bundle

`diagnostics/Hinge/api-diagnostics-20260319-211919/` — gitignored, available locally.
Hinge (dating app): 21 nodes (3 master + 18 hot), 117 indices, ES 9.3.1, AWS us-east-1. Kibana bundle also present.

Run: `npm run generate -- --customer Hinge --name "Hinge"`
