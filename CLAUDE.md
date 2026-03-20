# Bundle Visualizer

Local React web app for Elastic SAs to quickly orient on a customer cluster from an Elasticsearch diagnostic bundle.

## Workflow

The app has no browser file picker. Data is baked in at build time:

1. SA places bundle(s) in `diagnostics/<customer>/`
2. SA tells Claude Code: "Read and execute the instructions in GENERATE.md"
3. Claude asks questions, runs `npm run generate`, then `npm run build`
4. SA opens `dist/index.html` — no server needed

## Commands

```bash
npm run generate -- --customer <dirname> --name "Name" [--notes "text"]
                         # Read bundle from diagnostics/<dirname>/, write src/generated/bundleData.ts
npm run build            # TypeScript check + Vite build → dist/
npm run dev              # Dev server (requires bundleData.ts to exist — run generate first)
```

## Project Structure

```
scripts/
  generate.ts       # Node.js generator: reads bundle from disk → src/generated/bundleData.ts
src/
  generated/
    bundleData.ts   # AUTO-GENERATED — gitignored, contains customer data, never commit
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
GENERATE.md         # SA/Claude workflow instructions — read this to run a generate
```

## Key Conventions

- **UI**: @elastic/eui components only, dark theme (`colorMode="dark"` on EuiProvider)
- **Missing data**: skip silently — no "N/A", no "data not available" banners. If a section has no data, don't render it.
- **Defensive parsers**: all parsers return null/empty on missing or malformed files, never throw
- **Git**: user handles all commits — never run `git commit` or `git push`
- **Generated data**: `src/generated/bundleData.ts` is gitignored — never commit it

## Reference Bundle

`diagnostics/api-diagnostics-20260319-211919` — gitignored, available locally.
Hinge (dating app): 21 nodes (3 master + 18 hot), 117 indices, ES 9.3.1, AWS us-east-1.

To use the reference bundle with the new generate flow, place it under a customer subfolder:
```
diagnostics/hinge/api-diagnostics-20260319-211919/
```
Then run: `npm run generate -- --customer hinge --name "Hinge"`
