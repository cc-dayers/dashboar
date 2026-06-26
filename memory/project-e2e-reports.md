---
name: project-e2e-reports
description: E2E Playwright CI report support added to dashboar in June 2026 — report type e2e-aggregate, API endpoint, fixtures.
metadata:
  type: project
---

Added full E2E Playwright report support to dashboar (2026-06-25).

**New files:**
- `api/get-artifact.ts` — Fetches arbitrary blob by `blobPath` (not just report.json). Adds CORS headers for trace.playwright.dev. Same SAS token resolution as get-blob.ts.
- `src/lib/blobFetch.ts` — Client-side utilities: `fetchArtifactJson(blobPath, reportType)`, `artifactProxyUrl()`, `traceViewerUrl()`.
- `src/reports/e2e/types.ts` — `E2eAggregateReport`, `E2eRunEntry`, `E2eRunReport`, `E2eTest`, `E2eArtifact` etc.
- `src/reports/e2e/Dashboard.tsx` — Sidebar with run list; fetches per-run detail via `reportBlobPath` on selection.
- `src/reports/e2e/OverviewView.tsx` — KPI cards, status bar, run table (failed first).
- `src/reports/e2e/RunDetailView.tsx` — Per-run detail with test list, error messages, trace/screenshot artifact links.
- `fixtures/e2e-aggregate/report.json` — 6-run aggregate fixture (mixed passed/failed/flaky)
- `fixtures/e2e-aggregate/future.json` — schemaVersion "99" for unsupported-version UI testing
- `fixtures/e2e-run/example.json` — Per-run fixture with 4 failed tests + trace/screenshot artifacts
- `fixtures/review-audit/example.json` — 5-review audit fixture with feedback and downstream impact

**Modified:**
- `src/reports/index.ts` — Added `e2e-aggregate` registry entry; added `fixtures: ['example']` to `review-audit`
- `src/reports/pr-review/types.ts` — Added `workspace?: string | null` to `PrReview` (was used in DetailView but missing from type)
- `src/reports/pr-review/DetailView.tsx` — Removed dead `ModelMeta` function (logic was inlined in `ModelChips`)
- `src/lib/schemaVersion.test.ts` — Updated tests: version "2" IS now supported (SUPPORTED_VERSIONS has 1, 2, legacy)

**Design decisions:**
- E2E registry type is `e2e-aggregate` (not `e2e`). The per-run report is a secondary fetch within the Dashboard, not its own registry entry.
- `runKey()` uses `reportBlobPath` as the stable key — it's unique per run. Falls back to positional `run-{i}`.
- Two report planes (review-agent vs E2E) have separate REPORT_NAMES entries and can have separate SAS tokens via `AZURE_SAS_TOKENS`.
- `get-artifact.ts` validates blobPath doesn't start with http:/https:// or contain `..` to prevent SSRF.

**Why:** CareContinuity publishes CI report JSONs to Azure Blob from both the review-agent and Playwright/E2E runners. The dashboard needed to consume both planes without conflating them.
**How to apply:** Use `fetchArtifactJson(blobPath, reportType)` for secondary blob fetches in new report dashboards. For trace links use `traceViewerUrl(blobPath, reportType)`.
