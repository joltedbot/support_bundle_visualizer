# Bundle Visualizer — Generate Instructions

These instructions are for Claude Code. When an SA says "read and execute GENERATE.md", follow the steps below to produce a static HTML report from a diagnostic bundle.

---

## Step 1 — Identify the customer folder

Ask the user:

> "Which customer directory inside `diagnostics/` should I use for this run? (e.g., `hinge`)"

The `diagnostics/` folder should contain a subfolder named after the customer. Inside that subfolder the SA must have placed:
- `api-diagnostics-YYYYMMDD-HHMMSS/` — the Elasticsearch diagnostic bundle (**required**)
- `kibana-api-diagnostics-YYYYMMDD-HHMMSS/` — the Kibana diagnostic bundle (**optional but recommended**)

If the Kibana bundle is absent, the app works without it and omits Kibana-specific data silently.

## Step 2 — Confirm the customer display name

The customer display name will appear prominently in the report header. Infer it from the directory name the user provided (e.g., `hinge` → `Hinge`, `acme-corp` → `Acme Corp`).

Ask the user to confirm or correct it:

> "I'll use **`<InferredName>`** as the customer display name. Does that look right, or would you like to change it?"

Use the confirmed name exactly — it may include spaces, capitalisation, or punctuation (e.g., "Hinge (Dating App)", "ACME Corp").

## Step 3 — Gather optional notes

Ask the user:

> "Do you have any notes to include in the report? (optional — e.g., reason for this run, open questions, pre-call context). Press enter to skip."

If the user provides notes, include them as the `--notes` argument. Notes appear in a **Notes** section at the bottom of the report. They are visible when the report is shared.

## Step 4 — Run the generate script

Run the following command, substituting the values confirmed above:

```bash
npm run generate -- --customer "<dirname>" --name "<Customer Display Name>" [--notes "<notes text>"]
```

Examples:
```bash
npm run generate -- --customer hinge --name "Hinge"
npm run generate -- --customer acme --name "ACME Corp" --notes "Pre-renewal call. Focus on shard sizing and ILM gaps."
```

The script will:
1. Read all files from `diagnostics/<dirname>/api-diagnostics-*/`
2. Parse the bundle into a structured data model
3. Detect whether a Kibana bundle is present
4. Write `src/generated/bundleData.ts` (this file is gitignored and never committed)

## Step 5 — Build the report

```bash
npm run build
```

This produces `dist/index.html` (and supporting assets in `dist/`). Open `dist/index.html` directly in any browser — no server required.

## Step 6 — Done

Tell the user where the output is:

> "Report generated at `dist/index.html`. Open it in your browser — no server needed."

---

## Folder structure reference

```
diagnostics/
  <customer>/
    api-diagnostics-YYYYMMDD-HHMMSS/     ← ES bundle (required)
    kibana-api-diagnostics-YYYYMMDD-HHMMSS/  ← Kibana bundle (optional)
```

Create a new customer folder for each engagement. Multiple customers can coexist in `diagnostics/` — the generate script only processes the one you specify.

## Notes on privacy

- `diagnostics/` is gitignored — diagnostic files are never committed.
- `src/generated/bundleData.ts` is gitignored — generated customer data is never committed.
- The `dist/` folder is gitignored — built reports are never committed.
- Be mindful when sharing `dist/index.html` — it contains cluster topology and configuration data.
