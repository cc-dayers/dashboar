---
name: project-overview
description: Dashboar is a lightweight React dashboard for viewing CI report JSONs from Azure Blob Storage. Key patterns and stack.
metadata:
  type: project
---

Dashboar is a Vite + React 19 + TypeScript SPA deployed on Vercel, connected to Azure Blob Storage via per-report-type SAS tokens.

**Key patterns:**
- URL-param driven navigation: `?report=pr-review&path=container/folder&id=report`
- Report registry in `src/reports/index.ts` — add `lazy()` import + label/description/fixtures/schemaVersions
- All blob fetching via Vercel serverless functions (`api/get-blob.ts`, `api/get-artifact.ts`) — SAS tokens never in browser
- SAS token config: `AZURE_SAS_TOKENS=type:token,type:token` (split on first colon per entry)
- Per-report schemas: `schemaVersions` in registry maps version string to public schema URL
- `SUPPORTED_VERSIONS` in `src/lib/schemaVersion.ts`: currently `{"1", "2", "legacy"}`
- Inline styles with CSS vars (`var(--color-surface)` etc.) — almost no Tailwind in report components
- Fixtures served at `?_fixture=dev` when `FIXTURE_SECRET` env var is set
- Tests: `npm test` runs `tsx src/lib/schemaVersion.test.ts` (only schema version logic tested)

**Why:** No framework router — just URL params + React state. SAS tokens kept server-side always.
**How to apply:** Follow existing patterns when adding new report types; don't embed SAS tokens or blob URLs client-side.
