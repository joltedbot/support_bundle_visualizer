# Bundle Visualizer — Generate Instructions

These instructions are for Claude Code. When an SA says "read and execute GENERATE.md", follow the steps below to produce a static HTML report from a diagnostic bundle.

---

## Step 1 — Identify the customer folder

Ask the user:

> "Which customer directory inside `diagnostics/` should I use for this run? (e.g., `hinge`)"

The `diagnostics/` folder should contain a subfolder named after the customer. That subfolder has one of two layouts:

**Single deployment** (bundles directly inside):
```
diagnostics/<customer>/
  api-diagnostics-YYYYMMDD-HHMMSS/     ← ES bundle (required)
  kibana-api-diagnostics-YYYYMMDD-HHMMSS/  ← Kibana bundle (optional)
```

**Multiple deployments** (each subdirectory is a deployment):
```
diagnostics/<customer>/
  <deployment-1>/
    api-diagnostics-YYYYMMDD-HHMMSS/
    kibana-api-diagnostics-YYYYMMDD-HHMMSS/
  <deployment-2>/
    api-diagnostics-YYYYMMDD-HHMMSS/
```

The generate script auto-detects which layout is present. If the structure doesn't match either pattern, stop and ask the user to check the directory.

## Step 2 — Confirm the customer display name

The customer display name will appear prominently in the report header. Infer it from the directory name the user provided (e.g., `hinge` → `Hinge`, `acme-corp` → `Acme Corp`).

Ask the user to confirm or correct it:

> "I'll use **`<InferredName>`** as the customer display name. Does that look right, or would you like to change it?"

Use the confirmed name exactly — it may include spaces, capitalisation, or punctuation (e.g., "Hinge (Dating App)", "ACME Corp").

## Step 2b — Ask for the cluster/deployment name (single deployment only)

**Skip this step for multi-deployment customers.** In multi-deployment mode, cluster names are derived automatically from the deployment directory names (hyphens replaced with spaces).

For single deployments, the cluster name stored in the diagnostic bundle is an internal UUID, not the human-readable deployment name. Ask the user:

> "What's the name of this cluster or deployment? (e.g., 'Hinge Prod', 'Logging Cluster'). Press enter to skip."

If provided, this name appears in the report header alongside the customer name and is used as the browser tab title. If skipped, only the customer name is used.

## Step 3 — Gather optional notes

Ask the user:

> "Do you have any notes to include in the report? (optional — e.g., reason for this run, open questions, pre-call context). Press enter to skip."

If the user provides notes, include them as the `--notes` argument. Notes appear in a **Notes** section at the bottom of the report. They are visible when the report is shared.

## Step 4 — Run the generate script

Run the following command, substituting the values confirmed above:

```bash
pnpm run generate -- --customer "<dirname>" --name "<Customer Display Name>" [--cluster "<Cluster Name>"] [--notes "<notes text>"]
```

Examples:

**Single deployment:**
```bash
pnpm run generate -- --customer Hinge --name "Hinge" --cluster "Hinge Prod"
```

**Multi-deployment:**
```bash
pnpm run generate -- --customer "ADA Support" --name "ADA Support"
```

For single deployments, the script generates data files. For multi-deployment customers, the script generates and builds all deployments automatically — skip to Step 6.

## Step 5 — Build the report (single deployment only)

**Skip this step for multi-deployment customers** — the generate script handles the build for each deployment.

```bash
pnpm run build
```

This produces `output/<dirname>/index.html`.

## Step 6 — Done

Tell the user where the output is:

**Single deployment:**
> "Report generated at `output/<dirname>/index.html`. Open it in your browser — no server needed."

**Multi-deployment:**
> "Reports generated for all deployments in `output/<dirname>/`. Each deployment has its own `index.html`. Open any of them in your browser — no server needed."

---

## Folder structure reference

**Single deployment:**
```
diagnostics/
  <customer>/
    api-diagnostics-YYYYMMDD-HHMMSS/     ← ES bundle (required)
    kibana-api-diagnostics-YYYYMMDD-HHMMSS/  ← Kibana bundle (optional)
```

**Multi-deployment:**
```
diagnostics/
  <customer>/
    <deployment-1>/
      api-diagnostics-YYYYMMDD-HHMMSS/
      kibana-api-diagnostics-YYYYMMDD-HHMMSS/
    <deployment-2>/
      api-diagnostics-YYYYMMDD-HHMMSS/
```

Create a new customer folder for each engagement. Multiple customers can coexist in `diagnostics/` — the generate script only processes the one you specify.

## Notes on privacy

- `diagnostics/` is gitignored — diagnostic files are never committed.
- `src/generated/bundleData.ts` is gitignored — generated customer data is never committed.
- The `dist/` folder is gitignored — built reports are never committed.
- Be mindful when sharing report HTML files — they contain cluster topology and configuration data.
