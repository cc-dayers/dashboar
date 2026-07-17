# Review Audit

A meta-analysis of the PR Review agent's output: how humans actually responded
to its findings, whether feedback was collected, and what downstream impact its
reviews had. Where PR Review tells you what the agent said, Review Audit tells
you how well it landed.

## Overview

- KPI grid: review count, total findings, reviews with downstream impact
  triggered, token/cost totals, and the audit's own schema version.
- Result breakdown (approved / changes requested / commented) as a proportion
  bar.
- Feedback collection status (complete / partial / not collected) with counts
  of human replies, accepted-or-thanked findings, claimed false positives, and
  findings with no observed reply.
- Source report metadata — which underlying PR Review report this audit was
  generated from.

## Detail view

Selecting an entry shows the original review's metrics alongside the audit
signals: feedback summary, improvement signals, and (when available) the
finding-level detail sourced from `hatDetails`, review state, or Bitbucket
comments — whichever the audit was able to recover.
