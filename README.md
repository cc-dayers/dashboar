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
| `AZURE_BLOB_BASE_URL` | yes | Base URL of your Azure Blob container, e.g. `https://account.blob.core.windows.net/container` |
| `AZURE_SAS_TOKEN` | if private | SAS token string (with or without leading `?`). Appended server-side; never reaches the browser. |
| `REPORT_NAMES` | yes | Comma-separated report entries — see format below. |
| `FIXTURE_SECRET` | dev/staging | Enables fixture serving when `?_fixture=<secret>` is in the URL. |

### REPORT_NAMES format

Each entry is `type:path` or `type:path:filename`:

```
REPORT_NAMES=pr-review:reports/pr-review,review-audit:reports/pr-review:review-audit
```

- **`type`** — must match a registered report type (`pr-review`, `review-audit`, etc.)
- **`path`** — blob path under the base URL, e.g. `reports/pr-review`
- **`filename`** _(optional)_ — JSON filename without extension. Defaults to `report`; if not found, falls back to `{type}` (e.g. `review-audit.json`).

The full blob URL becomes `{AZURE_BLOB_BASE_URL}/{path}/{filename}.json`.

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
