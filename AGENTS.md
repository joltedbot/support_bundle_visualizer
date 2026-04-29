# AGENTS.md

> User-level CLAUDE.md handles: pnpm/socket aliases, MCP servers,
> elasticsearch-expert subagent, RPI framework, three-strikes rule.
> Do not duplicate those here.
> Note: CLAUDE.md is a symlink to this file. They are the same file.

## Tech Stack

| Layer | Package | Pinned Version |
|-------|---------|----------------|
| Language | TypeScript | ~5.9.3 |
| Runtime | Node.js | 18+ |
| UI Framework | React | 19.2.4 |
| Build | Vite | 8.0.3 |
| Component Library | @elastic/eui | 113.3.0 |
| Charts | @elastic/charts | 71.3.0 |
| CSS-in-JS | @emotion/react | 11.14.0 |
| CSS-in-JS | @emotion/css | 11.13.5 |
| Emotion cache | @emotion/cache | 11.14.0 |
| Theme | @elastic/eui-theme-borealis | 6.2.0 |
| Date handling | moment | 2.30.1 |
| Date math | @elastic/datemath | 5.0.3 |
| Test runner | Vitest | 4.1.0 |
| Linter | ESLint | 9.39.4 |
| TS linting | typescript-eslint | 8.57.0 |
| Security lint | eslint-plugin-security | 4.0.0 |
| Secret scanning | secretlint | 11.4.0 |
| Single-file bundler | vite-plugin-singlefile | 2.3.2 |
| Script runner | tsx | 4.21.0 |

## Commands

```
pnpm install          # Install dependencies
pnpm run generate     # Run data bake step — MUST run before build
pnpm run build        # Vite build — outputs standalone index.html
pnpm run dev          # Dev server
pnpm test             # Vitest unit tests
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
| `docs/BUNDLE_DATA_INDEX.md` | Local file | Authoritative index of all diagnostic bundle data. Consult first to check available ES/Kibana diagnostic data, see what the app currently parses, or plan new features. Do NOT re-scan raw bundle directories. |
| `docs/UI_SPECS.md` | Local file | Strict business rules and presentation logic for the React components. |
| Node.js docs | https://nodejs.org/docs/latest-v18.x/api/ | Core API — pinned to v18 |
| pnpm docs | https://pnpm.io/motivation | Workspace and CLI behaviour |
| TypeScript docs | https://www.typescriptlang.org/docs/ | Compiler options, type system edge cases |
| Vite docs | https://vite.dev/guide/ | Build config, plugin API |
| Vitest docs | https://vitest.dev/guide/ | Test runner API |
| EUI docs | https://eui.elastic.co | Component API — verify against 113.x |
| Elastic Charts | https://elastic.github.io/elastic-charts | Chart component API |
| Emotion docs | https://emotion.sh/docs/introduction | CSS-in-JS API |
| elastic-docs MCP | (via MCP server) | Elastic product docs — use MCP, not elastic.co/docs |

## Context File Maintenance

### Updating this file

Updating AGENTS.md is part of task completion, not optional cleanup.

Add an entry to Non-Standard Patterns when:
- You made an incorrect assumption that caused a wrong edit or broken build
- A pattern in the codebase surprised you and the reason was not obvious
- You were corrected by the user on a design decision

Do not add general TypeScript or Node advice. Do not paraphrase existing entries.
