/** External link builders for PR review detail view — Bitbucket PR / Jira ticket. */

const WORKSPACE_REPO_SHAPE = /^[\w.-]+\/[\w.-]+$/

function trimTrailingSlash(s: string) {
  return s.replace(/\/+$/, '')
}

/**
 * Builds a Bitbucket PR URL from `{workspace}/{repo}` + PR number.
 * Base defaults to bitbucket.org (Cloud) but is configurable for
 * self-hosted Bitbucket Server via VITE_BITBUCKET_BASE_URL.
 * Returns null (hide the button) if repository/prNumber are missing or malformed.
 */
export function bitbucketPrUrl(repository: string | undefined, prNumber: number | undefined): string | null {
  if (!repository || !prNumber || !WORKSPACE_REPO_SHAPE.test(repository)) return null
  const base = trimTrailingSlash(import.meta.env.VITE_BITBUCKET_BASE_URL || 'https://bitbucket.org')
  return `${base}/${repository}/pull-requests/${prNumber}`
}

/**
 * Builds a Jira ticket URL from the ticket key. Requires VITE_JIRA_BASE_URL
 * to be configured (e.g. https://yourorg.atlassian.net/browse/) — the Jira
 * domain can't be derived from report data, so no button without it.
 */
export function jiraTicketUrl(key: string | undefined): string | null {
  const base = import.meta.env.VITE_JIRA_BASE_URL
  if (!base || !key) return null
  return `${trimTrailingSlash(base)}/${key}`
}
