# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Vite (port 5173) + dev-api.ts (port 3001) concurrently
npm run build        # tsc -b && vite build
npm run test         # unit tests (schemaVersion only — runs via tsx, no test runner)
npm run test:e2e     # Playwright end-to-end tests
npm run validate:reports  # validate fixture JSON files against schemas
```

For E2E tests against a specific test file:
```bash
npx playwright test tests/pr-review.spec.ts
```

Local dev requires `.env` or `.env.local` with `AZURE_BLOB_BASE_URL`, `REPORT_NAMES`, and SAS token variables. See `.env.example` for all vars.

## Architecture

### Request flow

1. **Browser** — single-page app at `http://localhost:5173`. No routing library; the entire URL is `/?report=<type>&...`.
2. **Vite dev proxy** — all `/api/*` requests are proxied to `localhost:3001` (see `vite.config.ts`). In production, `/api/*` are Vercel serverless functions in `api/`.
3. **API layer** — server-side handlers attach SAS tokens before forwarding to **Azure Blob Storage**. Browser never sees the SAS token.

### App boot (src/App.tsx)

`App` reads `?report=`, looks it up in `registry` (from `src/reports/index.ts`), then calls `/api/get-blob` to load the report JSON. On success it lazy-imports the matching `Dashboard` component and renders it. Schema validation runs client-side against a frozen JSON schema fetched from `public/schemas/`.

### Report type registry (src/reports/index.ts)

Every report type is registered here with:
- `component` — lazy-imported `Dashboard.tsx`
- `label` / `description` — shown on the landing page
- `schemaVersions` — maps version strings to public schema URLs (optional)
- `fixtures` — list of fixture filenames available under `fixtures/{type}/`

Registered types: `simple`, `pr-review`, `playwright-trace`, `review-audit`, `e2e-aggregate`. Both `playwright-trace` and `e2e-aggregate` load the same `src/reports/e2e/Dashboard.tsx`.

### Report module structure

Each report type under `src/reports/{type}/` follows a consistent pattern:
- `types.ts` — TypeScript interfaces for the JSON schema
- `Dashboard.tsx` — top-level component: owns sidebar state, mobile layout, run/item selection. Implements the CSS visibility-swap pattern (both overview and detail panels stay mounted; `visibility: hidden` prevents unmounting iframes).
- `OverviewView.tsx` — aggregate charts/KPIs
- `DetailView.tsx` or `RunDetailView.tsx` — single-item detail panel

`Dashboard` receives `{ data: unknown, reportId: string }` from `App` and casts `data` to the typed interface.

### API endpoints (api/ and scripts/dev-api.ts)

| Endpoint | Purpose |
|---|---|
| `/api/get-blob` | Fetches report JSON by type+path. Resolves REPORT_NAMES, handles fixture serving |
| `/api/blob` | Generic binary blob proxy for trace zips, artifacts; prepends container to path |
| `/api/get-artifact` | Fetches artifact JSON (not binary) by explicit blob path |
| `/api/get-trace` | Fetches trace zip by ID (legacy endpoint) |
| `/api/list-blobs` | Lists blobs at a prefix (used by playwright-trace landing) |
| `/api/get-html-report` | Serves an HTML report artifact |
| `/api/auth` | Cookie-based auth: login/logout |

`scripts/dev-api.ts` is the local equivalent of all `api/*.ts` handlers combined — it runs on port 3001 and must stay in sync with the Vercel functions.

### REPORT_NAMES format (critical)

```
type:container/prefix:optionalFilename
```

- `type` — matches registry key
- `container/prefix` — first segment is the Azure **container name**; rest is the blob prefix
- `optionalFilename` — override for the JSON filename (default: `report`, fallback: `{type}`)

`/api/blob` must prepend the container extracted from REPORT_NAMES because `blobPath` values inside report JSON are relative to the container root. `resolveContainer()` extracts the first path segment for this purpose.

### Playwright trace viewer

A pre-built trace viewer from `playwright-core` is copied to `public/trace-viewer/` by the `postinstall` script. This gives same-origin serving so the trace viewer's service worker can register and fetch trace zips through `/api/blob` without CORS issues. The iframe must **not** have a `sandbox` attribute for the SW to register.

### CSS design system

CSS custom properties are defined in `src/index.css` using Tailwind's `@theme`. Tokens cover `--color-background`, `--color-surface*`, `--color-border*`, `--color-foreground*`, `--color-accent*`, and `--color-sidebar-*`. The sidebar tokens are adaptive — they're set for light mode under `@theme` and overridden for dark mode in the media query and `[data-theme="dark"]`. Inline styles use `var(--color-*)` throughout; Tailwind utility classes are used in `App.tsx` and `LandingPage.tsx`.

`--color-sidebar-success` / `--color-sidebar-danger` are theme-aware green/red for sidebar pill text (dark shade in light mode, bright in dark mode).

### Shared UI components

- `PanelTopBar` — top bar for report panels: `left` / `center` / `right` slots. Center is absolutely positioned. Use this in every report Dashboard.
- `ReportSidebar` — scrollable sidebar shell with mobile drawer behavior
- `SidebarBoarHeader` — boar logo + back-to-home link for the sidebar header
- `MobileTopBar` — hamburger bar shown only on mobile
- `ThemeToggle` — light/dark toggle, reads/writes `data-theme` on `<html>`

### Adding a new report type

1. `src/reports/{type}/types.ts` — define interfaces
2. `src/reports/{type}/Dashboard.tsx` — implement, use `PanelTopBar` / `ReportSidebar`
3. Register in `src/reports/index.ts`
4. Add `fixtures/{type}/example.json`
5. Test locally with `?report={type}&id=example&_fixture=dev`

### Schema versioning (pr-review)

`src/lib/schemaVersion.ts` maps `schemaVersion` field values to frozen schema snapshots in `public/schemas/`. When adding a new version: add the schema JSON to `public/schemas/`, add to `SUPPORTED_VERSIONS`, and register in the `schemaVersions` map in `src/reports/index.ts`.

### Fixtures

`fixtures/{type}/{name}.json` — served by `/api/get-blob` when `?_fixture=<FIXTURE_SECRET>` is in the URL. The landing page links to them automatically when `FIXTURE_SECRET` is set.
