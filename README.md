# Support Bundle Visualizer

A local tool for Elastic SAs to quickly orient on a customer cluster from an Elasticsearch diagnostic bundle. Produces a self-contained static HTML report — no server or internet connection required.

## Prerequisites

- Node.js 18+
- An Elasticsearch diagnostic bundle (`api-diagnostics-YYYYMMDD-HHMMSS/`)
- Optionally a Kibana diagnostic bundle (`kibana-api-diagnostics-YYYYMMDD-HHMMSS/`)

## Setup (first time)

```bash
npm install --legacy-peer-deps
```

(React 19 and `@elastic/charts` have peer dependency conflicts; `--legacy-peer-deps` allows installation.)

## Generating a report

### 1. Place your diagnostic bundle

Create a folder named after the customer inside `diagnostics/` and place the bundle(s) inside it:

```
diagnostics/
  acme-corp/
    api-diagnostics-20260101-120000/     ← required
    kibana-api-diagnostics-20260101-120000/  ← optional
```

Multiple customers can coexist in `diagnostics/` — each gets their own subfolder.

### 2. Tell Claude Code to generate the report

```
Read and execute the instructions in GENERATE.md
```

Claude will ask you to confirm the customer name and any notes, then run the generate and build steps automatically.

### 3. Open the report

```
output/<customer>/index.html
```

Open this file directly in any browser — no server needed. It's a self-contained HTML file (~2MB) with all CSS and JavaScript inlined. Each customer has their own output folder so reports are never overwritten.

---

## Running manually (without Claude)

```bash
# Generate bundle data
npm run generate -- --customer acme-corp --name "ACME Corp" --notes "Pre-renewal call"

# Build the report
npm run build

# Output is at:
open output/acme-corp/index.html

# Run tests (optional)
npx vitest run
```

---

## What's in the report

| Section | Contents |
|---|---|
| Cluster Header | Customer name, cluster name (if available) |
| Overview | Solution type (Search/Observability/Security), ES version, cluster health, node/index counts |
| Topology | Nodes grouped by availability zone (if available) or tier; AZ summary bar showing tier distribution |
| Index Landscape | Index counts, shard distribution, size breakdown |
| Resource Health | Heap, disk, CPU per node (when available) |
| Features & Integrations | ILM, ML, CCR, snapshots, installed plugins |
| Data Profile | Index size distribution, ILM policy coverage |
| Best Practices | Automated observations and recommendations |
| Notes | Any pre-call context you added at generate time |

Sections with no data are omitted automatically — no empty panels.

---

## Privacy

- `diagnostics/` is gitignored — bundle files are never committed
- `src/generated/` is gitignored — generated customer data is never committed
- `output/` is gitignored — built reports are never committed
- Be mindful when sharing `output/<customer>/index.html` — it contains cluster topology and configuration data
