# PR Review

Tracks an AI code-review agent's activity across pull requests: how long each
review took, how accurate it was rated, what it found, and what it cost.

## Overview

- **KPI row** — total reviews, average review time (with a trend arrow
  comparing the current window against the equivalent prior window), % changes
  requested, average accuracy rating, and AI-credit/billing usage.
- **Avg Review Time Over Time** — a chart of average review time bucketed by
  hour/day/week depending on the active date range filter.
- **Reviews by period** — outcome breakdown (approved / changes requested /
  commented) over time.
- **Token traffic & billing per review** — provider-measured totals, prompt estimates, and Copilot AI-credit usage per PR.
- **Findings by hat / Author activity / Model & provider breakdown** — who's
  reviewing, which "hats" (review personas) are finding the most issues, and
  which LLM providers/models are doing the work.

Use the date-range buttons in the top-right to scope every chart to Today /
3d / 7d / 14d / 30d / All.

## Detail view

Selecting a PR from the sidebar shows:

- A header with the PR title, labeled metadata (author, repository, branch,
  target release when known), and quick-open buttons for the Bitbucket PR and
  Jira ticket (shown only when both the data and the relevant
  `VITE_BITBUCKET_BASE_URL` / `VITE_JIRA_BASE_URL` are configured).
- Metrics: review time, accuracy rating, total tokens, and AI credits.
- Usage anatomy: provider input/output, cache read/write, reasoning tokens,
  request count, initial prompt estimate, telemetry provenance, and token cost.
- Downstream impact banner (when the change triggered contract/reference
  analysis), review notes, and the full findings list grouped by hat, each
  finding tagged with severity and type (issue/suggestion/praise).

## Sidebar

Each entry shows the PR number, its target release (e.g. `→ release/6.30`)
when the upstream data includes one, the review date, and a truncated title.
Search matches PR number, title, repository, author, branch, and notes.
