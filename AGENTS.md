# AGENTS.md

> User-level CLAUDE.md handles: pnpm/socket aliases, MCP servers,
> elasticsearch-expert subagent, RPI framework, three-strikes rule.
> Do not duplicate those here.
> Note: CLAUDE.md is a symlink to this file. They are the same file.

## Commands

```
pnpm install          # Install dependencies
pnpm run generate     # Run data bake step — MUST run before build
pnpm run build        # Vite build — outputs standalone index.html
pnpm run dev          # Dev server
pnpm exec vitest run  # Vitest unit tests (no `test` script in package.json)
pnpm run lint         # ESLint
pnpm exec secretlint  # Secret scan
```

## Build Pipeline — Critical Sequence

This project uses a two-stage build. Both stages must run in order.

**Stage 1 — Data bake**: `scripts/generate.ts` (executed via `tsx`) reads raw
diagnostic JSON/text, runs it through parsers in `src/parsers/`, and writes
a structured `BundleModel` to `src/generated/bundleData.ts`.

**Stage 2 — Vite build**: Vite compiles the React app and uses
`vite-plugin-singlefile` to inline all assets into a single `index.html`.

The output is a **fully self-contained, portable HTML file** with no external
dependencies. This is the entire point of the project — the file is handed to
customers and run locally with no server.

Do NOT:
- Add runtime network requests or external asset loading — the file must work
  offline and without a server
- Modify the output format away from single-file — this would break the
  customer delivery model
- Skip the generate step and run build directly — the app will build but
  contain stale or missing data
- Add a CDN, backend, or hosting dependency of any kind

## Data Architecture

- Raw input: diagnostic JSON/text (customer-provided)
- Parsers: `src/parsers/` — TypeScript, unit-tested with Vitest
- Bake output: `src/generated/bundleData.ts` — do not hand-edit this file,
  it is always overwritten by `scripts/generate.ts`
- The `BundleModel` type is the contract between the bake step and the UI —
  changing it requires updating both `generate.ts` and the consuming components

## EUI and Theming

- Theme is `@elastic/eui-theme-borealis` with dark mode as primary target
- Emotion is required by EUI — do not remove or replace it
- `@emotion/cache` is pinned to 11.14.0 — this resolved a conflict; do not
  upgrade it independently of EUI

## Non-Standard Patterns

- **Data Architecture**: Diagnostic data is "baked" into `src/generated/bundleData.ts` at build time. A naive agent might try to add a runtime file picker or API fetch; this would break the portability of the single-file report as `file://` protocols block cross-origin requests.
- **Single-File Build**: Assets are inlined via `vite-plugin-singlefile`. A naive agent might try to use standard code-splitting; this would break the report as browsers block `type="module"` scripts when opened directly from the filesystem.
- **Silent UI**: Components must skip rendering entirely if data is missing. A naive agent might add "N/A" or empty-state banners; these are forbidden as they clutter reports generated from partial diagnostic bundles.
- **Defensive Parsing**: Parsers in `src/parsers/` must never throw, returning `null` or empty objects instead. A naive agent might use strict error handling; this would cause a single missing file in a bundle to crash the entire generation process.
- **Kibana Sizing**: Use `heap.size_limit` from `kibana_status.json` for instance size. A naive agent might use OS RAM from the bundle; in Elastic Cloud, OS RAM reflects the host machine (e.g., 64GB) while the instance is actually much smaller (e.g., 1GB).
- **Node Sorting**: Topology view uses a fixed priority (master > ml > ingest > etc). A naive agent might use alphabetical sorting; fixed priority is required so the "brain" of the cluster is always visible first regardless of naming.
- **Average Shard Size Calculation**: Use `pri.store.size` from `cat_indices.txt` to calculate average primary shard size. A naive agent might try to aggregate individual shards from `cat_shards.txt`; this is unnecessarily complex and prone to errors when shard data is incomplete.
- **Multi-Deployment Layout**: `generate.ts` detects a nested `diagnostics/<customer>/<deployment>/` structure. A naive agent might assume a 1:1 mapping between customer and bundle; this layout is required to process multiple environment snapshots in a single build.
- **Vitest Configuration**: In `vite.config.ts`, you must import `defineConfig` from `vitest/config` (not `vite`). A naive agent might import it from `vite`; this will cause TypeScript errors because the `test:` config block is not part of Vite's default type definitions.
- **lang_ident Trained Model Visibility**: `lang_ident_model_1` is always present but decorative — the helper `significantModels()` filters it out for stat cards and `hasAnything()`. The `TrainedModelsPanel` guard uses `aiMl.trainedModels.length > 0` (all models) so it renders even for bundles where lang_ident is the only model; the panel renders it with a "Built-in" badge. A naive agent might restore the `nonTrivialModels.length > 0` guard, which silently hides the panel for those bundles.
- **Kibana `kibana_status.json` → `name` is a hostname, not a deployment name**: The `name` field in `kibana_status.json` is the Kibana node's `server.name` setting — typically a hostname (e.g. `kibana-node-1`). It is not a user-facing cluster or deployment label.
  Do NOT use `kibana_status.json` → `name` as a display name or cluster label anywhere in the app or generator.
- **Frozen Tier Disk is a Pre-Allocated Cache**: For frozen tier nodes using searchable snapshots, the disk appears 97–98% full because Elasticsearch pre-allocates the shared snapshot cache file at node startup regardless of whether frozen indices are actively in use — `disk.indices = 0` in cat_allocation (no local shard data). `Topology.tsx` hides the disk usage bar entirely for frozen nodes and shows two text stats instead: "Snapshot Disk Cache" (pre-allocated cache size from `searchable_snapshots_cache_stats.json`, joined by `NodeInfo.id`) and "Searchable Snapshots" (total remote dataset bytes from shard data, always rendered even when 0). These two values are distinct: cache is the local pre-allocation, snapshot data is the remote dataset size.
  Do NOT restore a disk bar for frozen nodes, treat high disk utilisation as a bug, or join cache stats by node name instead of `NodeInfo.id`.
- **ESS Cluster Name Sources — `cluster_health.json` Returns a UUID on Cloud**: On ESS/Cloud, `cluster_health.json` → `cluster_name` is the deployment UUID (32 lowercase hex chars), not a human-readable name. `readEsClusterName()` in `generate.ts` tries three sources in priority order: (1) `cluster_settings.json` → `cluster.metadata.display_name` (transient wins over persistent), (2) `nodes.json` → `deploymentName` (ESS-specific top-level field; value includes a short hex suffix in parentheses, e.g. `terentiauksouthes (24721c)` — this is verbatim from ESS, not appended by the app), (3) `cluster_health.json` → `cluster_name` only if it does not match `/^[a-f0-9]{32}$/`.
  Do NOT simplify `readEsClusterName()` to read only `cluster_health.json` — this returns a raw UUID on every ESS/Cloud deployment and would surface as the report title.
- **Uniform Keys on Per-Index Fields**: `generate.ts` emits `src/generated/bundleData.ts` as an untyped object literal, so TypeScript infers a union over every distinct index object shape. Optional per-index fields (e.g. on `IndexInfo`) make shapes diverge, and `tsc` fails with TS2590 "union type too complex" only on very large bundles (Mengo, ~6k indices) while small bundles pass.
  Do NOT add an optional or conditionally-present field to `IndexInfo` (or other per-item arrays in `BundleModel`); always populate it with a default (`null`/`false`) so every object has identical keys.
- **No `tsc` in CI**: `src/generated/` is gitignored, so a clean CI checkout has no `bundleData.ts` and `tsc -b` fails on the missing module. Type-checking only works locally after `pnpm run generate`.
  Do NOT add a `tsc -b` step to `.github/workflows/node.js.yml`.
- **Scoped secretlint runs**: a bare `secretlint "**/*"` walks local gitignored bundle directories and crashes on very large files (a 16 GB file was hit). The tracked `.secretlintignore` does not cover this on its own.
  Do NOT run `secretlint "**/*"` without `--secretlintignore .gitignore`.
- **Palette Colours**: component colours come from `src/theme/palette.ts` (`usePalette()` built on `useEuiTheme` tokens, `SOLUTION_BADGE_COLORS`, `levelBadgeColor`) or named `EuiBadge` colours — the user prefers EUI tokens over hex, and duplicated colours should be harmonised. Hex/rgba literals are not theme-aware and previously drifted (the same solution had different colours in different components).
  Do NOT add hex or rgba literals in `src/components/`, and do NOT call `usePalette()` after an early return.

## Constraints

- secretlint must pass before any commit — it prevents sensitive customer
  data leaking into generated reports
- Do not add dependencies without flagging to the user first — this is a
  customer-delivered artifact and supply chain hygiene matters
- ESLint security plugin rules are not advisory — do not disable them
- TypeScript strict mode is on — do not add `@ts-ignore` or `any` to work
  around type errors; fix the types
- **Build Warnings**: `vite-plugin-singlefile` emits an `inlineDynamicImports` deprecation warning during the build process. This originates upstream in the plugin itself. Do NOT attempt to fix this warning; no action is required.

## Autonomous Operation

This project is operated by SAs who may not have deep Node/TS familiarity.
Flag to the user and wait for confirmation before:
- Changing the build pipeline or output format
- Adding or removing dependencies
- Modifying any script in `scripts/`
- Changing how data is ingested, transformed, or bundled
- Any refactor touching more than 3 files

When uncertain whether a change is safe, ask.

## Reference Bundles

When testing parser changes or UI updates, use these local gitignored bundles to verify your work:
- **Cloud + Kibana** (Standard): `pnpm run generate -- --customer Hinge --name "Hinge" --cluster "Hinge Prod"`
- **Self-hosted** (No Kibana): `pnpm run generate -- --customer "Presidents Choice Financial" --name "Presidents Choice Financial"`
- **Multi-deployment**: `pnpm run generate -- --customer "ADA Support" --name "ADA Support"`

## Reference Documentation

Consult these before web searching. Do not fetch speculatively — only when
verifying a specific API, version constraint, or behaviour you are uncertain of.

| Resource | URL | When to use |
|----------|-----|-------------|
| `docs/DIAGNOSTIC_BUNDLE_REFERENCE.md` | Local file | Authoritative reference for all diagnostic bundle data: every file, key field paths, non-obvious parsing rules, cloud vs self-hosted differences. Consult first when working with bundle data or planning new features. Do NOT re-scan raw bundle directories. |
| `docs/DIAGNOSTIC_THRESHOLDS.md` | Local file | Thresholds and interpretation — what a metric value means and when to act. Consult when assessing cluster health or adding a health/severity judgement to parsers or UI. |
| EUI docs | https://eui.elastic.co | Component API — verify against the version in package.json |
| Elastic Charts | https://elastic.github.io/elastic-charts | Chart component API |
| elastic-docs MCP | (via MCP server) | Elastic product docs — use MCP, not elastic.co/docs |
