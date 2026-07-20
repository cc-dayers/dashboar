# Playwright Traces

Aggregates Playwright/E2E CI runs: pass/fail/flaky status per run, per-test
detail, and links into the Playwright HTML report and trace viewer for any
individual test.

## Overview

- A 24H/7D/30D/ALL time-range toggle filters everything below it — the KPI
  summary, suite cards, and browser matrix all recompute for the selected
  window. The window is anchored to the newest run in the report (not
  wall-clock time), so historical/fixture reports still show data.
- KPI summary (runs, pass rate, tests, flaky) for the selected range.
- One card per suite with pass rate/failed/flaky and a trend sparkline;
  clicking a card jumps to that suite's most recent run in the sidebar.
- A browser matrix table (runs, avg duration, failed, flaky, pass rate, trend)
  breaking down results by browser.
- The sidebar lists one row per logical run — a CI build fans out into a
  separate report per browser target (its own blob, own pass/fail counts), but
  those targets are grouped into a single row (matched by build + suite) with
  small clickable chips for each browser rather than shown as separate runs.
  The row's dot and stats always reflect the *worst* target so a failure on
  one browser is never hidden behind a healthier one. Failed rows are called
  out with a red badge so regressions are easy to spot at a glance. Use the
  status filter or search to narrow the list.

## Run detail

Selecting a run fetches its per-run detail JSON (a secondary blob fetch, not
part of the aggregate payload) and shows:

- A "Targets" pill bar when the run has more than one browser target — each
  pill is colored by that target's own status; the view defaults to Chromium
  when present, and clicking a pill switches to that target's report/trace
  without leaving the sidebar's current run group.
- The full test list for that run, with failed tests surfaced first.
- Error messages for failing tests.
- Links to any attached artifacts — screenshots, and the trace viewer (opens
  Playwright's own trace UI, served same-origin so its service worker can
  register).

Run detail stays mounted when you navigate back to the overview, so returning
to a previously-viewed run doesn't refetch or reload its trace iframe.
