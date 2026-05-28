# Support Bundle Visualizer

A local tool for Elastic SAs to quickly orient on a customer cluster from an Elasticsearch diagnostic bundle. Produces a self-contained static HTML report — no server or internet connection required.


## Prerequisites

- Node.js 18+
- An Elasticsearch diagnostic bundle:
  - Cloud (ESS): `api-diagnostics-YYYYMMDD-HHMMSS/`
  - Self-hosted: `local-diagnostics-YYYYMMDD-HHMMSS/`
- Optionally a Kibana diagnostic bundle (`kibana-api-diagnostics-YYYYMMDD-HHMMSS/` for cloud, `kibana-local-diagnostics-YYYYMMDD-HHMMSS/` for self-hosted)

## Setup (first time)

```bash
pnpm install
```

(pnpm v10 handles the React 19 and `@elastic/charts` peer dependency conflicts automatically.)

## Generating a report

### 1. Place your diagnostic bundle

Create a folder named after the customer inside `diagnostics/` and place the bundle(s) inside it:

```
diagnostics/
  acme-corp/
    api-diagnostics-20260101-120000/           ← ESS cloud bundle
    kibana-api-diagnostics-20260101-120000/    ← optional Kibana bundle (cloud)
    kibana-local-diagnostics-20260101-120000/  ← optional Kibana bundle (self-hosted)

  my-self-hosted/
    local-diagnostics-20260101-120000/         ← self-hosted bundle
```

Multiple customers can coexist in `diagnostics/` — each gets their own subfolder.

### 2. Generate the report

```bash
pnpm run generate -- --customer acme-corp --name "ACME Corp" --cluster "Production" --notes "Pre-renewal call"
pnpm run build
```

**`pnpm run generate` flags**

| Flag | Required | Description |
|------|----------|-------------|
| `--customer <dirname>` | Yes | Folder name inside `diagnostics/` containing the bundle. Must match exactly — this is the directory name, not the display name. |
| `--name <string>` | Yes | Customer display name shown in the report header. Quote if it contains spaces. |
| `--cluster <string>` | No | Cluster name shown in the report header and browser tab title. Omit if unknown. |
| `--notes <string>` | No | Free-text context added to the Notes section of the report (e.g. pre-call context, known issues). Quote if it contains spaces. |

### 3. Open the report

```
output/<customer>/index.html
```

Open this file directly in any browser — no server needed. It's a self-contained HTML file (~2MB) with all CSS and JavaScript inlined. Each customer has their own output folder so reports are never overwritten.

---

## What's in the report

| Section | Contents |
|---|---|
| Cluster Header | Customer name, cluster name (if provided via `--cluster` flag) |
| Overview | Solution type (Search/Observability/Security), ES version, cluster health, node/index counts |
| Topology | Nodes grouped by availability zone (if available) or tier; AZ summary bar showing tier distribution; each node shows vCPU count, RAM, and disk capacity |
| Index Landscape | Index counts, shard distribution, and average shard size breakdown |
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
