# Dashboar

A lightweight report viewer hosted on Vercel. JSON report files live in Azure Blob Storage; the app fetches and renders them as interactive dashboards with a sidebar + main panel layout.

---

## Local development

```bash
cp .env.example .env.local   # fill in the vars below
npm install
npm run dev                   # Vite dev server + API server together
```

Open `http://localhost:5173` — the landing page lists all configured reports and any local fixtures.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `AZURE_BLOB_BASE_URL` | yes | Azure Blob account URL — account-level only, no container, e.g. `https://account.blob.core.windows.net` |
| `REPORT_NAMES` | yes | Comma-separated report entries — see format below. Container and path go here, not in the base URL. |
| `AZURE_SAS_TOKEN` | if private | Global SAS token (with or without leading `?`). Used for any report without a per-type token. |
| `AZURE_SAS_TOKENS` | optional | Per-report-type SAS tokens — see format below. Takes precedence over `AZURE_SAS_TOKEN`. |
| `FIXTURE_SECRET` | dev/staging | Enables fixture serving when `?_fixture=<secret>` is in the URL. |

### REPORT_NAMES format

Each entry is `type:path` or `type:path:filename`:

```
REPORT_NAMES=pr-review:cc-review-agent/reports/pr-review,review-audit:cc-review-agent/reports:review-audit
```

- **`type`** — must match a registered report type (`pr-review`, `review-audit`, etc.)
- **`path`** — full blob path including container, e.g. `cc-review-agent/reports/pr-review`
- **`filename`** _(optional)_ — JSON filename without extension. Defaults to `report`; if not found, falls back to `{type}` (e.g. `review-audit.json`).

The full blob URL becomes `{AZURE_BLOB_BASE_URL}/{path}/{filename}.json`.

### AZURE_SAS_TOKENS format

Each entry is `type:token` where token is the raw SAS query string:

```
AZURE_SAS_TOKENS=pr-review:sp=r&st=2026-01-01T00:00:00Z&se=2027-01-01T00:00:00Z&sig=...,review-audit:sp=r&st=...
```

- Entries are comma-separated; the type and token are split on the **first `:` only** — colons inside SAS timestamps (e.g. `00:19:11Z`) are preserved.
- `AZURE_SAS_TOKEN` (singular) is used as a fallback for any type not listed here.
- Rotate one token without touching others by updating only that entry.

---

## Deploying to Vercel

```bash
vercel deploy
```

Set all env vars in the Vercel project settings (or via `vercel env add`). The API functions run server-side so the storage URL and SAS token are never exposed to the browser.

---

## URL scheme

| URL | What it loads |
|---|---|
| `/` | Landing page — lists all configured reports |
| `/?report=pr-review&path=reports/pr-review` | Loads `report.json` (or `pr-review.json` as fallback) from the given path |
| `/?report=review-audit&path=reports/pr-review&id=review-audit` | Loads `review-audit.json` explicitly |
| `/?report=pr-review&id=example&_fixture=dev` | Serves `fixtures/pr-review/example.json` locally |

The `path` parameter overrides the `REPORT_NAMES` storage path for that request. The `id` parameter overrides the filename (without `.json`).

---

## Report types

| Type | Schema | Description |
|---|---|---|
| `pr-review` | `report.schema.json` / `report.v{N}.schema.json` | AI PR review agent — accuracy trends, review time, cost, hats, per-PR findings |
| `review-audit` | `review-audit.schema.json` | PR review audit — feedback signals, improvement data, downstream impact, summary stats |
| `playwright-trace` | — | Playwright test trace viewer |
| `infrastructure` | — | Generic system health dashboard |
| `simple` | — | Raw JSON viewer, useful as a starting point |

### Schema versioning (pr-review)

`pr-review` reports embed a `schemaVersion` field. The dashboard validates each report against its frozen schema snapshot and shows a warning banner if there are mismatches.

| schemaVersion | Schema file | Notes |
|---|---|---|
| `legacy` | `pr-review.v1.schema.json` | Pre-versioned reports |
| `1` | `pr-review.v1.schema.json` | Initial schema |
| `2` | `pr-review.v2.schema.json` | Adds expanded `downstreamImpact` fields (`riskClasses`, `affectedAreas`, `validationCount`, `warningCount`) |

Frozen schema snapshots live in `public/schemas/`. When a new schema version is introduced, add `pr-review.v{N}.schema.json` there, add the version to `SUPPORTED_VERSIONS` in `src/lib/schemaVersion.ts`, and register it in `src/reports/index.ts`.

---

## Adding a new report type

1. Create `src/reports/{type}/types.ts` — TypeScript types matching your JSON schema
2. Create `src/reports/{type}/Dashboard.tsx` — React component receiving `{ data: unknown, reportId: string }`
3. Register it in `src/reports/index.ts`
4. Add a fixture at `fixtures/{type}/example.json` for local testing
5. Add to `REPORT_NAMES` in your env file

Use `PanelTopBar` from `src/components/PanelTopBar.tsx` for the main panel header — it centers the boar home-link and accepts `left` / `right` slots for your own content.
