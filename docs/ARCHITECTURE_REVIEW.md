# Architecture Review — Support Bundle Visualizer

**Date:** 2026-06-24  
**Reviewed by:** Claude Code (four parallel agents: architecture, security, performance, component/UX)  
**Branch:** architecture

This document is the authoritative source for planned changes arising from the June 2026 review.
Update task status in-place as work is completed. Each priority group is intended to be implemented
in a separate session.

---

## How to Read This Document

- **P0** — Correctness or security issues. Fix before next customer delivery.
- **P1** — Critical test coverage gaps on the most complex/risky code paths.
- **P2** — Bundle size: affects every customer delivery artifact.
- **P3** — Architecture: duplication, type safety, extensibility.
- **P4** — Component quality: consistency, accessibility, spec compliance.
- **P5** — Polish: low-risk cleanup items.

Each task has an **Acceptance Criteria** section. A task is done when all criteria pass.

---

## P0 — Correctness & Security

### P0-1: Fix symlink traversal in `readDirRecursive`

**File:** `scripts/generate.ts:104–120`

**Problem:** `readDirRecursive` uses `statSync` which follows symlinks. A customer-provided bundle
containing a symlink pointing outside the bundle directory (e.g., `link -> /etc/passwd`) will be
read and embedded into `bundleData.ts`.

**Fix:** Replace the `statSync(full).isDirectory()` check with `lstatSync`. Skip any entry where
`lstatSync(full).isSymbolicLink()` returns true before deciding to recurse or read.

**Acceptance Criteria:**
- [x] `readDirRecursive` uses `lstatSync` (not `statSync`) to check entries
- [x] Symlink entries are silently skipped (not recursed into, not read)
- [x] A bundle directory containing a symlink processes correctly without error
- [x] Existing generate behaviour for normal bundles is unchanged

---

### P0-2: Fix `FleetSection` to comply with the silent UI spec

**File:** `src/components/FleetSection.tsx:30–54`

**Problem:** The component renders text banners ("No Kibana data available…" and "Fleet is not
deployed or has no active agents/policies…") when data is absent. CLAUDE.md explicitly forbids
empty-state banners: *"Components must skip rendering entirely if data is missing."*
Every other conditional section returns `null` silently.

**Fix:**
- When `kibana` prop is `null`: return `null` immediately.
- When Fleet data is absent/inactive (no agents, no policies): return `null`.
- Remove both banner `EuiCallOut`/`EuiPanel` blocks.
- The conditional guard in `App.tsx` that controls whether `FleetSection` renders should be
  updated to match the new null-return logic.

**Acceptance Criteria:**
- [x] `FleetSection` returns `null` for all data-absent cases
- [x] No text banners or empty-state messages remain in the component
- [x] App.tsx conditional guard is consistent with the component's null-return conditions
- [x] FleetSection still renders correctly when Fleet data is present

---

### P0-3: Consolidate `SOLUTION_COLORS` into a single shared constant

**Files:** `src/components/Overview.tsx:17–21`, `src/components/FeaturesIntegrations.tsx:18–22`

**Problem:** Both components define a `SOLUTION_COLORS` map for the same `search`, `observability`,
`security` keys, but with different hex values. The `security` color differs dramatically:
`#017D73` (teal) in Overview vs `#bd271e` (red) in FeaturesIntegrations — a visible bug.

**Fix:**
- Create `src/utils/solutionColors.ts` exporting a single `SOLUTION_COLORS` constant.
- Decide canonical values (the red `#bd271e` for security is the correct Elastic Security brand
  color; `#017d73` is Elastic Observability).
- Both components import from the shared location.

**Acceptance Criteria:**
- [x] Single `SOLUTION_COLORS` constant in `src/utils/solutionColors.ts`
- [x] Both `Overview.tsx` and `FeaturesIntegrations.tsx` import from it
- [x] The same solution type renders the same badge color in both components
- [x] Correct canonical values: search `#0071c2`, observability `#017d73`, security `#bd271e`

---

### P0-4: Add `scripts/` to TypeScript strict compilation

**Files:** `tsconfig.app.json`, `tsconfig.node.json`

**Problem:** `scripts/generate.ts` is executed by `tsx` at runtime and is not included in any
`tsconfig` covered by `tsc -b`. Type errors in the ingestion/bake path are never caught at
build time.

**Fix:** Create `tsconfig.scripts.json`:
```json
{
  "extends": "./tsconfig.node.json",
  "compilerOptions": { "strict": true },
  "include": ["scripts"]
}
```
Add it to `tsconfig.json`'s `references` array so `tsc -b` covers it.

**Acceptance Criteria:**
- [x] `pnpm run build` (which calls `tsc -b`) also type-checks `scripts/generate.ts`
- [x] `strict: true` is enforced on the scripts directory
- [x] No new type errors are introduced (fix any that surface)
- [x] `tsx` runtime execution of generate.ts is unchanged

---

## P1 — Test Coverage

### P1-1: Add tests for `parseNodes`

**File:** `src/parsers/nodes.ts` (no test file exists)

**Problem:** `parseNodes` is the most complex parser: it merges 4 separate source files
(`nodes.json`, `nodes_stats.json`, `cat/cat_nodes.txt`, `cat/cat_nodeattrs.txt`), has a
multi-step fallback chain for resource stats, and derives `tier` from role combinations.
`determineTier` and `normalizeRole` are not exported, making them untestable in isolation.

**Fix:**
- Export `determineTier` and `normalizeRole` from `nodes.ts` (or extract to
  `src/utils/nodeRoles.ts` alongside the existing `nodeRoles.ts` utilities).
- Create `src/parsers/nodes.test.ts` with fixture-based tests.

**Key scenarios to cover:**
- Node with `data_hot` role → tier `hot`
- Node with `data` role only → tier `data` (legacy)
- Node with `master` + `data_warm` roles → tier `warm` (data tier takes precedence over master)
- `cat_nodes.txt` absent → falls back to `nodes_stats.json` for heap/CPU
- `nodes_stats.json` absent → graceful empty stats
- `cat_nodeattrs.txt` with `az` attribute → populates `zone`
- Node present in `nodes.json` but absent from `nodes_stats.json` → no crash

**Acceptance Criteria:**
- [x] `determineTier` and `normalizeRole` are exported and independently testable
- [x] `src/parsers/nodes.test.ts` exists and passes with `pnpm exec vitest run`
- [x] All key scenarios above are covered
- [x] No existing tests broken

---

### P1-2: Add tests for `parseILM` and `parseMinAgeDays`

**File:** `src/parsers/ilm.ts` (no test file exists)

**Problem:** The dual-shape handling of `ilm_explain.json` (`.indices` wrapper vs flat top-level
structure) is the primary conditional logic in this parser and is entirely untested. The exported
`parseMinAgeDays` function handles edge cases (`6M`, `24h`, `0ms`, `null`) none of which are
currently exercised.

**Key scenarios to cover:**
- `ilm_explain.json` with `.indices` wrapper shape
- `ilm_explain.json` with flat (no wrapper) shape
- `ilm_explain.json` absent → returns `null` or empty result
- `ilm_policies.json` absent → graceful empty
- `parseMinAgeDays`: `"7d"`, `"6M"`, `"24h"`, `"0ms"`, `""`, `null`
- Policy with multiple phases — hot/warm/cold/delete rollover ages parsed correctly

**Acceptance Criteria:**
- [x] `src/parsers/ilm.test.ts` exists and passes
- [x] Both `ilm_explain.json` shapes produce correct output
- [x] `parseMinAgeDays` edge cases all covered
- [x] No existing tests broken

---

### P1-3: Add tests for `generate.ts` deployment detection

**File:** `scripts/generate.ts:59–87` (`detectDeploymentMode`)

**Problem:** `detectDeploymentMode` has 3 branches (`single`, `multi`, `ambiguous`) and is
entirely untested. The multi-deployment path is the most complex feature of the bake step.

**Fix:** Extract `detectDeploymentMode` into a separately importable function (it currently is
inline). Create `scripts/generate.test.ts` using a temp directory fixture approach.

**Key scenarios to cover:**
- Directory with a single valid bundle → `single`
- Directory with multiple valid deployment subdirectories → `multi`
- Directory that is itself a bundle root (no nested structure) → correct detection
- Ambiguous / empty directory → `ambiguous`

**Acceptance Criteria:**
- [x] `detectDeploymentMode` is exported for testing
- [x] `scripts/generate.test.ts` exists and passes with `pnpm exec vitest run`
- [x] All 3 branch cases covered with temp-dir fixtures
- [x] No existing tests broken

---

### P1-4: Add tests for `parseShards`

**File:** `src/parsers/shards.ts` (no test file exists)

**Problem:** The `oversized` (> 50 GB) and `undersized` (< 1 GB, primary only) threshold flags
drive warning icons in `IndexLandscape`. These are business-critical UI signals with magic-number
thresholds and no tests.

**Key scenarios to cover:**
- Shard exactly at 50 GB → not flagged as oversized
- Shard at 50 GB + 1 byte → flagged as oversized
- Primary shard at 1 GB − 1 byte → flagged as undersized
- Replica shard at < 1 GB → NOT flagged (undersized check is primaries only)
- `cat_shards.txt` absent → returns empty array (no crash)
- Shard with missing store size field → handled gracefully

**Acceptance Criteria:**
- [x] `src/parsers/shards.test.ts` exists and passes
- [x] Boundary values for both thresholds covered
- [x] Replica exclusion from undersized check covered
- [x] No existing tests broken

---

## P2 — Bundle Size

### P2-1: Use compact JSON serialization for `bundleData.ts`

**File:** `scripts/generate.ts:191–193`

**Problem:** `JSON.stringify(output, null, 2)` pretty-prints the generated data file. For large
clusters this adds 20–40% character overhead (whitespace) that flows directly into the final
`index.html` since Vite inlines everything.

**Fix:** Change to `JSON.stringify(output)` (no indentation). The file is machine-generated and
explicitly documented as not hand-editable.

**Acceptance Criteria:**
- [x] `bundleData.ts` is generated with compact (no-whitespace) JSON
- [x] `pnpm run generate && pnpm run build` completes without error
- [x] Generated `index.html` is smaller for the same input bundle
- [x] App renders correctly from a compactly-serialized bundle

---

### P2-2: Remove raw `shards[]` from `BundleModel`; pre-aggregate at bake time

**Files:** `src/parsers/types.ts`, `src/parsers/index.ts`, `src/components/IndexLandscape.tsx`,
`scripts/generate.ts`

**Problem:** The full `ShardInfo[]` array is serialized into `bundleData.ts`. A 50k-shard cluster
produces a several-MB shards array. Current consumers only need:
1. A set of index names with oversized/undersized shards (drives warning icons in `IndexLandscape`)
2. Per-node shard counts (already computed in `parseBundle` at line 72–81 and joined onto nodes)

Shard display in the UI is a known open problem — a full shard table is not practical at this
scale. The raw array will be revisited when a suitable shard visualization approach is designed.

**Fix:**
- In `parsers/index.ts`, compute `flaggedIndices: string[]` (index names where any shard is
  oversized or undersized) during the bake step, from the existing shard data.
- Remove `shards: ShardInfo[]` from `BundleModel` in `types.ts`.
- Update `IndexLandscape.tsx` to use `flaggedIndices` directly (currently it derives this set
  from `shards` at render time).
- Remove `ShardInfo` from `types.ts` if no longer referenced.

**Acceptance Criteria:**
- [x] `BundleModel` no longer contains `shards: ShardInfo[]`
- [x] `BundleModel` contains `flaggedIndices: string[]`
- [x] `IndexLandscape.tsx` warning icons still render for oversized/undersized indices
- [x] Generated `bundleData.ts` is measurably smaller for a large bundle
- [x] `pnpm run generate && pnpm run build` completes without error
- [x] `parseShards` tests (P1-4) still pass

---

### P2-3: Audit and remove `moment` dependency

**File:** `package.json:22`

**Problem:** `moment` is ~280 KB minified and non-tree-shakeable. It is a transitive dependency
of `@elastic/datemath`. If `datemath` functions are not called at React render time, both
`moment` and `datemath` are dead weight in the bundle.

**Fix:**
1. Search all component and utility files for any import or usage of `moment` or `datemath`.
2. If neither is used at render time (only in the bake step `generate.ts`), move both to
   `devDependencies`.
3. If `datemath` is used in `generate.ts` only (not in `src/`), Vite will not bundle it.
4. If `datemath` is used in `src/`, evaluate whether its functionality can be replaced with
   a lightweight alternative or inlined.

**Acceptance Criteria:**
- [x] All usages of `moment` and `datemath` in `src/` are identified
- [x] If used only in `scripts/`, both are moved to `devDependencies`
- [x] `pnpm run build` completes without error
- [x] Bundle size of `index.html` decreases (verify with `ls -lh`)
- [x] Any date formatting in components still renders correctly

---

## P3 — Architecture & Maintainability

### P3-1: Extract `parseSize` to a shared utility

**Files:** `src/parsers/indices.ts:8–28`, `src/parsers/shards.ts:11–29`

**Problem:** `parseSize` (converts ES size strings like `"1.2gb"` to bytes) is duplicated in two
parsers with different implementations. `indices.ts` correctly uses an ordered `[string, number][]`
to avoid iteration-order issues; `shards.ts` uses `Object.entries` on a plain object, which is
subtly less correct.

**Fix:** Create `src/utils/parseSize.ts` exporting the `indices.ts` version (ordered array).
Both parsers import from it. Remove their local copies.

**Acceptance Criteria:**
- [ ] `src/utils/parseSize.ts` exists and exports `parseSize`
- [ ] Both `indices.ts` and `shards.ts` import from it and remove their local copies
- [ ] All existing parser tests pass
- [ ] The shared implementation uses the ordered `[string, number][]` approach

---

### P3-2: Extract `parseMinAgeDays` to a shared utility

**Files:** `src/parsers/ilm.ts:42–59` (exported), `src/parsers/sizing.ts:39–55` (private copy)

**Problem:** Identical function duplicated. `sizing.ts` does not import the exported version
from `ilm.ts` — a logic fix must be applied in two places.

**Fix:** Move `parseMinAgeDays` to `src/utils/parseMinAgeDays.ts` (or include in a broader
`src/utils/dateUtils.ts`). Both `ilm.ts` and `sizing.ts` import from there.

**Acceptance Criteria:**
- [ ] Single canonical `parseMinAgeDays` in `src/utils/`
- [ ] Both `ilm.ts` and `sizing.ts` import from the shared location
- [ ] All existing tests (including `sizing.test.ts`) pass
- [ ] ILM test suite from P1-2 passes against the shared function

---

### P3-3: Create shared `rawTypes.ts` for ES API response interfaces

**Files:** `src/parsers/ilm.ts:21–36`, `src/parsers/sizing.ts:22–33`, `src/parsers/nodes.ts:16–24`

**Problem:** `ILMPhase`, `ILMPolicyEntry`, and `NodesStatsJson` are independently declared in
multiple parser files. Adding a new parser that needs the same types must redeclare them or
hunt for the canonical location.

**Fix:** Create `src/parsers/rawTypes.ts` (not exported from `index.ts` — internal to parsers).
Move all raw ES API response interfaces there. Each parser imports what it needs.

**Acceptance Criteria:**
- [ ] `src/parsers/rawTypes.ts` contains `ILMPhase`, `ILMPolicyEntry`, `NodesStatsJson`, and any
  other ES API response types currently duplicated across parsers
- [ ] Parser files import from `rawTypes.ts` and remove their local copies
- [ ] `tsc -b` passes with no errors
- [ ] All existing tests pass

---

### P3-4: Tighten `parseJsonFile<T>` with JSDoc contract and callsite documentation

**File:** `src/utils/bundleReader.ts:12–15`

**Problem:** `JSON.parse(content) as T` is an unsound cast. Given the build-time-only context
(not a production API server), full Zod validation is more than needed. However, the cast with
no documentation creates a trap for future parser authors who may omit defensive guards.

**Fix (lightweight approach):**
- Change return type to `unknown` and update all call sites to assert or narrow the type locally.
- Add a JSDoc comment on `parseJsonFile` stating the invariant: callers must not assume shape
  correctness; all field accesses must use optional chaining.
- Alternatively, keep the `as T` cast but change return type annotation to make the unsoundness
  explicit: `parseJsonFile<T = unknown>` with `T` defaulting to `unknown`.

**Acceptance Criteria:**
- [ ] The unsoundness of the JSON cast is documented in code (JSDoc or type default)
- [ ] All existing parsers continue to compile with `tsc -b`
- [ ] No new `any` types or `@ts-ignore` introduced

---

### P3-5: Fix `App.tsx` `BundleData` double-cast

**File:** `src/App.tsx:29`

**Problem:** `const data = rawBundleData as unknown as GeneratedBundle` silences any mismatch
between the baked file shape and the current `GeneratedBundle` / `BundleModel` types. Adding a
field to `BundleModel` without updating `generate.ts` produces a silent `undefined` at runtime.

**Fix:** The generated file should directly satisfy the type. In `generate.ts`, ensure the
`output` object is typed as `BundleModel` (or the `GeneratedBundle` wrapper type) before being
serialized — so any mismatch is caught at bake time, not silently at render time.

```typescript
// In generate.ts, after building output:
const typedOutput: BundleModel = output; // type error here if shape is wrong
```

**Acceptance Criteria:**
- [ ] `App.tsx` import no longer requires `as unknown as` double-cast
- [ ] `generate.ts` builds `output` with an explicit `BundleModel` type annotation
- [ ] Shape mismatches between generate.ts output and BundleModel are caught by `tsc -b`

---

### P3-6: Add `<Section>` wrapper component to eliminate `App.tsx` boilerplate

**File:** `src/App.tsx:55–207`

**Problem:** 12+ identical blocks of `{condition && (<><EuiSpacer/><EuiTitle size="s"><h3>…</h3>
</EuiTitle><EuiSpacer size="s"/><Component/></>)}`. Copy-paste risk on every new section.

**Fix:** Create `src/components/Section.tsx`:
```tsx
interface SectionProps {
  title: string;
  show: boolean;
  children: React.ReactNode;
}
export function Section({ title, show, children }: SectionProps) {
  if (!show) return null;
  return (
    <>
      <EuiSpacer size="l" />
      <EuiTitle size="s"><h3>{title}</h3></EuiTitle>
      <EuiSpacer size="s" />
      {children}
    </>
  );
}
```
Replace all repeated blocks in `App.tsx` with `<Section title="…" show={condition}>`.

**Acceptance Criteria:**
- [ ] `src/components/Section.tsx` exists with the above interface
- [ ] All 12+ repeated blocks in `App.tsx` replaced
- [ ] Spacer sizes match the current implementation (no visual regression)
- [ ] Conditional rendering behaves identically to current implementation

---

### P3-7: Extract `parseBundle` join passes to named functions

**File:** `src/parsers/index.ts:49–118`

**Problem:** Three sequential imperative passes over indices/shards (ILM join, shard count join,
tier storage computation) are embedded inline in `parseBundle`. Each join is well-commented but
not independently testable or scannable.

**Fix:** Extract each pass to a named private function:
- `joinIlmPolicies(indices, policyMap): IndexInfo[]`
- `joinShardCounts(indices, shards): IndexInfo[]`  
- `computeTierStorage(nodes, indices): NodeInfo[]`

Also: the two separate shard iteration passes (lines 72–81 for shard counts, lines 88–96 for
tier storage) can be merged into one pass since both only need `shard.node` and
`shard.storeSizeBytes`. Note: this task depends on P2-2 if shards are removed from the model —
coordinate accordingly.

**Acceptance Criteria:**
- [ ] Each join is a named function with explicit input/output types
- [ ] `parseBundle` orchestrator is scannable without reading join internals
- [ ] No behaviour change (existing tests pass, generate output is identical)

---

## P4 — Component Quality & Consistency

### P4-1: Fix `Topology.tsx` color usage to use `format.ts` and EUI tokens

**File:** `src/components/Topology.tsx:27–38, 299`

**Problem:**
- `TIER_COLORS` map uses hardcoded hex values instead of EUI vis palette or CSS variables.
- `KibanaCard` computes `statusColor` as raw hex and bypasses the existing `healthColor()`
  utility in `utils/format.ts`.

**Fix:**
- Replace `KibanaCard`'s inline health-to-color logic with a call to `healthColor()` from
  `utils/format.ts`.
- Evaluate whether `TIER_COLORS` can use EUI vis colors (`euiPaletteColorBlind`) or defined
  CSS variables for theme-awareness.

**Acceptance Criteria:**
- [ ] `KibanaCard` uses `healthColor()` from `utils/format.ts`
- [ ] `TIER_COLORS` either uses EUI vis palette tokens or is documented as an intentional
  override with a comment explaining why

---

### P4-2: Fix section header ownership inconsistency

**Files:** `src/components/FleetSection.tsx:23`, `src/components/SnapshotRepositories.tsx:79`,
`src/components/InternalHealthSection.tsx:45`

**Problem:** All section headers live in `App.tsx` except for these three components which own
their own. This makes global header restyling require hunting two locations. Note: P0-2 already
removes the FleetSection banners; this task removes the self-owned header too.

**Fix:**
- Remove the `<EuiTitle>` header from `FleetSection.tsx` and `SnapshotRepositories.tsx`.
- Move the header text to the `<Section>` call in `App.tsx` (task P3-6 provides this wrapper).
- For `InternalHealthSection.tsx`, align the internal sub-label to use `EuiTitle size="xs"`
  consistent with `DataProfile.tsx`'s sub-section pattern.

**Acceptance Criteria:**
- [ ] No component renders its own top-level section `<EuiTitle>` — all live in `App.tsx`
- [ ] Visual output is identical (same header text, same spacing)
- [ ] `SnapshotRepositories` panel wrapper (`EuiPanel`) inconsistency resolved: either all
  table sections use a panel or none do

---

### P4-3: Fix color-only status indicators (accessibility)

**Files:** `src/components/Topology.tsx:311`, `src/components/AiMlSection.tsx:438, 500`

**Problem:** Status is conveyed by color alone with no text backup or ARIA label:
- `KibanaCard` 8×8px colored dot has no text label or `aria-label`
- `AiMlSection` ML memory bar segments have no accessible labels
- `AiMlSection` index-type dots (user vs system) have no accessible labels on the dots

**Fix:**
- `KibanaCard` dot: add `aria-label={`Kibana status: ${kibana.status}`}` to the dot element,
  or replace dot with `EuiBadge` that includes the status text.
- `AiMlSection` memory bar: add `aria-label` to each segment with its percentage.
- `AiMlSection` index dots: add `title` attribute at minimum; better, add screen-reader text.

**Acceptance Criteria:**
- [ ] All colored status indicators have a text or ARIA label alternative
- [ ] No information is conveyed by color alone

---

### P4-4: Add `eslint-plugin-security` to `src/` lint pass

**File:** `eslint.config.js`

**Problem:** `eslint-plugin-security` is only applied to `scripts/**/*.ts`. Parser code in
`src/parsers/` that processes untrusted customer data is not scanned.

**Fix:** Add `security.configs.recommended` to the config block covering `src/`.

**Acceptance Criteria:**
- [ ] `pnpm run lint` runs the security plugin rules against `src/` files
- [ ] Any new security findings are triaged (fix genuine issues, disable with explanation for
  false positives)

---

## P5 — Polish

These items are low-risk and can be batched into any session.

| # | Task | File | Fix |
|---|------|------|-----|
| P5-1 | `enrichModelLabel(m)` called 3–4× per badge render | `IndexLandscape.tsx:153–155` | Store in `const label = enrichModelLabel(m)` at top of map callback |
| P5-2 | `sortNodesByRole` and `grouped` Map rebuilt each render | `Topology.tsx:250, 269–292` | Wrap with `useMemo` |
| P5-3 | `shards` iterated twice in `parseBundle` | `parsers/index.ts:72–96` | Merge into one pass (coordinate with P2-2) |
| P5-4 | Toggle buttons missing `aria-label`/`aria-pressed` | `IndexLandscape.tsx:256`, `DataStreams.tsx:183`, `IngestPipelines.tsx:175`, `DataProfile.tsx:243` | Add `aria-label` prop to each `EuiButtonEmpty` |
| P5-5 | `SnapshotRepositories` panel inconsistency | `SnapshotRepositories.tsx:81` | Remove `EuiPanel` wrapper to match all other table sections (see P4-2) |
| P5-6 | `indicator.details` renders `[object Object]` | `InternalHealthSection.tsx:74` | Guard: `typeof v === 'object' ? JSON.stringify(v) : String(v)` |
| P5-7 | `pnpm` in `dependencies` | `package.json:16` | Move to `devDependencies` |
| P5-8 | `CLAUDE.md` version table stale | `CLAUDE.md` | Update: EUI 114.3.0, Borealis 7.0.0, React 19.2.7, Vite 8.0.16, Vitest 4.1.9 |
| P5-9 | `Licensing.tsx` uses `React.ReactNode` without import | `Licensing.tsx:23` | `import type { ReactNode } from 'react'` and use `ReactNode` directly |
| P5-10 | `IngestPipelines` name cell `fontWeight: 'bold'` | `IngestPipelines.tsx:72` | Remove inline weight; match all other table name cells |
| P5-11 | `NodeInfo.tier` union and `TIER_FALLBACK_ORDER` independent | `Topology.tsx:267` | Type `TIER_FALLBACK_ORDER` as `Array<NodeInfo['tier']>` to get exhaustiveness |
| P5-12 | `NodeCard` IIFE in JSX | `Topology.tsx:149–165` | Extract `pct` to a `const` before the return statement |

---

## AiMlSection — Deferred Cleanup Notes

`AiMlSection.tsx` (1,149 lines) diverges significantly from the rest of the app and should be
addressed in the next session that modifies this component. Do not refactor in isolation — wait
until functional changes are needed there.

**Items to address at that time:**

1. **`StatCard` → `EuiStat`** (`AiMlSection.tsx:934–980`): Custom component duplicates `EuiStat`
   already used in `Overview.tsx`. Replace with `EuiStat` for visual consistency.

2. **20+ hardcoded hex colors**: `#111827`, `#2c3040`, `#c2c6d4`, `#6b7694`, `#8892a4`,
   `#98a2b3`, `#4c9aff`, `#7b61ff`, `#00bfb3`, `#a855f7`, `#ffab00` — none are EUI tokens.
   Replace panel backgrounds and borders with EUI theme variables; replace indicator colors
   with EUI vis palette entries.

3. **`IndexNameList` (lines 476–570)**: Entirely raw `<div>` layout. Replace with an EUI list
   or table pattern consistent with the rest of the app.

4. **`Pill` component (lines 731–759)**: Custom card built from raw `<div>`. Replace with
   a styled `EuiPanel` or `EuiBadge`.

5. **`Dot` component (lines 716–729)**: Raw `<span>` with inline styles. If kept, add
   `aria-label` per P4-3.

6. **`SemanticSearchPanel` stat numbers (lines 600–610)**: Manual font sizing duplicating
   `EuiStat` pattern.

7. **Sub-section header pattern** (Pattern A: `EuiText + <strong>` with `marginBottom: 12`):
   Align to Pattern B (`EuiTitle size="xs"` + `EuiSpacer size="s"`) used in DataProfile.

---

## Dependencies Between Tasks

```
P2-2 (remove shards[]) → P3-7 (join refactor) — coordinate or sequence
P0-2 (FleetSection) → P4-2 (header ownership) — P0-2 first
P3-6 (Section wrapper) → P4-2 (header ownership) — P3-6 first
P1-4 (shard tests) → P2-2 (remove shards[]) — write tests first, update with P2-2
P0-4 (scripts tsconfig) → may surface type errors in P3-5 (generate.ts typed output)
```
