# dashboar

A lightweight SvelteKit app for dashboard widgets plus local agent session/worktree management.

## Local development

```sh
npm install
npm run dev
```

## Build

```sh
npm run build
npm run start
```

## Features

- Dashboard widgets persisted in browser localStorage
- Agent sessions persisted in SQLite (`.dashboar/data.db` by default)
- Git worktree lifecycle management
- Agent process lifecycle controls (start/stop)
- Session logs, artifacts, and live SSE log streaming
- Session, worktree, health, and config APIs under `/api/*`

## Runtime configuration

You can configure settings from the `/config` page or with environment variables:

- `DASHBOAR_REPO_PATH`
- `DASHBOAR_WORKTREE_DIR`
- `DASHBOAR_BASE_BRANCH`
- `DASHBOAR_DEFAULT_MODEL`
- `DASHBOAR_MAX_CONCURRENT`
- `DASHBOAR_LOG_RETENTION_DAYS`
- `DASHBOAR_AGENT_COMMAND`
- `DASHBOAR_AGENT_ARGS`
- `DASHBOAR_DB_PATH`

## CI

The workflow at `.github/workflows/deploy.yml` runs install, type checks, and production build on pushes and pull requests.
