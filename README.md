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

**Multi-deployment layout**: if a customer has multiple clusters, place each cluster's bundle in a named subfolder. The tool detects this automatically:

```
diagnostics/
  ada-support/
    production/
      api-diagnostics-20260101-120000/
      kibana-api-diagnostics-20260101-120000/
    staging/
      api-diagnostics-20260101-120000/
```

### 2. Generate the report

**Single deployment:**
```bash
pnpm run generate -- --customer acme-corp --name "ACME Corp" --cluster "Production" --notes "Pre-renewal call"
pnpm run build
```

**Multi-deployment** (build runs automatically after each deployment):
```bash
pnpm run generate -- --customer ada-support --name "ADA Support"
```

**`pnpm run generate` flags**

| Flag | Required | Description |
|------|----------|-------------|
| `--customer <dirname>` | Yes | Folder name inside `diagnostics/` containing the bundle. Must match exactly — this is the directory name, not the display name. |
| `--name <string>` | Yes | Customer display name shown in the report header. Quote if it contains spaces. |
| `--cluster <string>` | No | Cluster name shown in the report header and browser tab title. Omit if unknown. In multi-deployment mode this is derived automatically from each subfolder name. |
| `--notes <string>` | No | Free-text context added to the Notes section of the report (e.g. pre-call context, known issues). Quote if it contains spaces. |

### 3. Open the report

```
output/<customer>/index.html                      ← single deployment
output/<customer>/<deployment>/index.html         ← multi-deployment
```

Open this file directly in any browser — no server needed. It's a self-contained HTML file (~2 MB) with all CSS and JavaScript inlined. Each customer has their own output folder so reports are never overwritten.

---

## What's in the report

Sections with no data are omitted automatically — no empty panels.

| Section | Contents |
|---|---|
| Cluster Header | Customer name, cluster name (if provided), bundle collection timestamp |
| Overview | Cluster health, deployment type (ESS/self-hosted, cloud region), solution badges (Search / Observability / Security) with ES and Kibana versions, identity/auth providers, node counts, active shards, store size, document count |
| Internal Health | Per-indicator health status for master stability, disk, shards, ILM, and SLM — color-coded red/yellow/green |
| Licensing | License type, status, expiry date, maximum nodes, and issuer |
| Topology | Nodes grouped by availability zone (falling back to tier); per-node vCPU, RAM, disk, role badges, and resource gauges (JVM heap %, disk %, CPU %, shard count); frozen tier nodes show "Snapshot Cache" for the disk bar (neutral color) and a "Snapshot data: X" line reflecting object-storage footprint derived from the `dataset` column; AZ summary bar showing tier distribution; Kibana nodes shown separately when a Kibana bundle is present |
| Features & Integrations | Enabled features as badges: ILM, CCR, snapshots, Fleet, Logstash, installed plugins, Kibana health |
| Fleet | Fleet Server hosts, agent status summary, Agent Policies with integration counts, and all installed integrations |
| Data Profile | Index and document counts, average document size; ILM & tiering breakdown with per-tier shard storage; snapshot repository and SLM policy summary; sizing estimates |
| AI & Machine Learning | Anomaly detection job count and state, trained model inventory, data frame analytics jobs, per-node ML memory, and semantic search panel (dense vector counts by dimension and inference model) |
| Index Landscape | Paginated sortable table: index name, type (data stream backing / alias-backed / standalone), ILM policy, ML model associations, health, status, primary/replica counts, average shard size, document count, and total size; flags oversized (>50 GB) and undersized (<1 GB) shards; toggle for system indices |
| Data Streams | Data stream inventory: name, system flag, status, backing index count, ILM policy, and lifecycle management source |
| Ingest Pipelines | Pipeline inventory with processor counts and descriptions |
| Cross-Cluster | Remote cluster connections (mode, proxy, connectivity), follower indices, and auto-follow patterns |
| Plugins | Deduplicated plugin inventory across all nodes |
| Snapshot Repositories | Repository name, type, snapshot count, success/failure summary, and key settings (bucket, base path, compression); SLM policy schedules, retention rules, and execution history |
| Best Practices | Automated observations and recommendations drawn from the parsed data |
| Notes | Any pre-call context you added at generate time via `--notes` |

---

## Privacy

- `diagnostics/` is gitignored — bundle files are never committed
- `src/generated/` is gitignored — generated customer data is never committed
- `output/` is gitignored — built reports are never committed
- Be mindful when sharing `output/<customer>/index.html` — it contains cluster topology, configuration, and security provider data
