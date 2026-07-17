# Playwright Traces

Aggregates Playwright/E2E CI runs: pass/fail/flaky status per run, per-test
detail, and links into the Playwright HTML report and trace viewer for any
individual test.

## Overview

- KPI row summarizing total runs and pass/fail/flaky counts.
- A stacked status bar and breakdown by suite/browser.
- The sidebar lists every run — failed runs are called out with a red badge so
  regressions are easy to spot at a glance. Use the status filter or search to
  narrow the list.

## Run detail

Selecting a run fetches its per-run detail JSON (a secondary blob fetch, not
part of the aggregate payload) and shows:

- The full test list for that run, with failed tests surfaced first.
- Error messages for failing tests.
- Links to any attached artifacts — screenshots, and the trace viewer (opens
  Playwright's own trace UI, served same-origin so its service worker can
  register).

Run detail stays mounted when you navigate back to the overview, so returning
to a previously-viewed run doesn't refetch or reload its trace iframe.
