# Dashboar

Dashboar is a single-page JSON report viewer. There's no backend rendering and no
routing library — the entire application state lives in the URL query string, and
every "report" is just a JSON file fetched from Azure Blob Storage (or, in
development, a local fixture file).

## Opening a report

The URL shape is:

```
/?report=<type>&id=<id>&path=<storagePath>
```

- **`report`** — which report type to render (`pr-review`, `playwright-trace`,
  `review-audit`, …). This selects both the Dashboard component and the schema
  used to validate the payload.
- **`id`** — a label for the specific report instance. Defaults to `report` if
  omitted. Purely cosmetic — shown in the UI, not used to look anything up.
- **`path`** — the Azure Blob Storage prefix to fetch the report JSON from. Omit
  this and the dashboard falls back to whatever `REPORT_NAMES` resolves for that
  report type.

If you omit `report` entirely, you get this landing page instead of a report.

## Fixtures (local/dev data)

Every report type can ship example JSON files under `fixtures/{type}/*.json` in
the repo. With a `FIXTURE_SECRET` configured, you can load any of them directly:

```
/?report=pr-review&id=example&_fixture=<FIXTURE_SECRET>
```

The landing page's "Fixtures" toggle on each report type card links to these
directly (collapsed by default to keep the page focused on real data — click to
expand).

## Schema versioning

Some report types (like `pr-review`) evolve their JSON shape over time. Each
report can declare a `schemaVersion` field; the dashboard keeps a frozen copy of
every schema version it has ever supported under `public/schemas/`, and
validates incoming JSON against whichever version the payload declares.

- If a report has no `schemaVersion` (an older report, predating this system),
  it's treated as **legacy** and rendered with the newest known shape.
- If a report declares a version this dashboard doesn't recognize yet (e.g. it
  was produced by a newer version of the upstream report generator), you'll see
  an "unsupported schema version" banner — the report still renders using the
  closest known shape, but some newer fields may not display.
- If a report's JSON doesn't fully match its declared schema, a "schema
  mismatch" banner lists the validation errors. The view still attempts to
  render.

Both banners are dismissible per page-load.

## The corner buttons

Every report Dashboard has two small buttons fixed to the bottom-right corner,
stacked on top of each other:

- **`{ } JSON`** — opens a full-screen raw JSON viewer for whatever's currently
  in view (the full report on the overview, or just the selected item on a
  detail view). You can copy or download it from there.
- **`? Docs`** — opens this documentation, defaulted to whichever report type
  you're currently viewing.

The landing page has its own `? Docs` button in the same corner, defaulted to
this general page.

## Adding a new report type

See `CLAUDE.md` in the repo root — it documents the file layout every report
type follows (`types.ts`, `Dashboard.tsx`, `OverviewView.tsx`, `DetailView.tsx`)
and the steps to register a new one.
