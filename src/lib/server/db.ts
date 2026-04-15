import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import type {
	AgentSession,
	ArtifactKind,
	LogLevel,
	SessionArtifact,
	SessionLog,
	SessionStatus
} from './types';

const dbPath = process.env.DASHBOAR_DB_PATH ?? path.join(process.cwd(), '.dashboar', 'dashboar.db');
mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS agent_sessions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  task TEXT NOT NULL,
  status TEXT NOT NULL,
  worktree_path TEXT NOT NULL,
  branch TEXT NOT NULL,
  base_branch TEXT NOT NULL,
  repo_path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  pid INTEGER,
  model TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session_logs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS session_artifacts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_session_logs_session_id ON session_logs(session_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_session_artifacts_session_id ON session_artifacts(session_id, created_at);
`);

type SessionRow = Omit<AgentSession, 'pid'> & { pid: number | null };

function toSession(row: SessionRow): AgentSession {
	return {
		...row,
		pid: row.pid ?? null
	};
}

export function nowIso() {
	return new Date().toISOString();
}

export function getDbPath() {
	return dbPath;
}

export function listSessions(status?: SessionStatus) {
	const stmt = status
		? db.prepare('SELECT * FROM agent_sessions WHERE status = ? ORDER BY created_at DESC')
		: db.prepare('SELECT * FROM agent_sessions ORDER BY created_at DESC');
	const rows = status ? stmt.all(status) : stmt.all();
	return (rows as SessionRow[]).map(toSession);
}

export function getSession(id: string) {
	const row = db.prepare('SELECT * FROM agent_sessions WHERE id = ?').get(id) as SessionRow | undefined;
	return row ? toSession(row) : null;
}

type InsertSessionParams = Omit<AgentSession, 'created_at' | 'updated_at'>;

export function insertSession(session: InsertSessionParams) {
	const createdAt = nowIso();
	db.prepare(
		`INSERT INTO agent_sessions (id, name, task, status, worktree_path, branch, base_branch, repo_path, created_at, updated_at, pid, model)
		 VALUES (@id, @name, @task, @status, @worktree_path, @branch, @base_branch, @repo_path, @created_at, @updated_at, @pid, @model)`
	).run({
		...session,
		created_at: createdAt,
		updated_at: createdAt
	});
	return getSession(session.id);
}

export function patchSession(
	id: string,
	updates: Partial<Omit<AgentSession, 'id' | 'created_at'>> & { updated_at?: string }
) {
	const current = getSession(id);
	if (!current) return null;

	const next = {
		...current,
		...updates,
		updated_at: updates.updated_at ?? nowIso()
	};

	db.prepare(
		`UPDATE agent_sessions
		 SET name=@name, task=@task, status=@status, worktree_path=@worktree_path, branch=@branch, base_branch=@base_branch, repo_path=@repo_path, updated_at=@updated_at, pid=@pid, model=@model
		 WHERE id=@id`
	).run(next);

	return getSession(id);
}

export function deleteSessionRow(id: string) {
	db.prepare('DELETE FROM agent_sessions WHERE id = ?').run(id);
}

export function insertLog(sessionId: string, level: LogLevel, message: string) {
	const log: SessionLog = {
		id: randomUUID(),
		session_id: sessionId,
		timestamp: nowIso(),
		level,
		message
	};
	db.prepare(
		'INSERT INTO session_logs (id, session_id, timestamp, level, message) VALUES (@id, @session_id, @timestamp, @level, @message)'
	).run(log);
	return log;
}

export function listLogs(sessionId: string, limit = 200, offset = 0) {
	const rows = db
		.prepare(
			'SELECT * FROM session_logs WHERE session_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?'
		)
		.all(sessionId, limit, offset) as SessionLog[];
	return rows.reverse();
}

export function insertArtifact(sessionId: string, kind: ArtifactKind, content: string) {
	const artifact: SessionArtifact = {
		id: randomUUID(),
		session_id: sessionId,
		kind,
		content,
		created_at: nowIso()
	};
	db.prepare(
		'INSERT INTO session_artifacts (id, session_id, kind, content, created_at) VALUES (@id, @session_id, @kind, @content, @created_at)'
	).run(artifact);
	return artifact;
}

export function listArtifacts(sessionId: string) {
	return db
		.prepare('SELECT * FROM session_artifacts WHERE session_id = ? ORDER BY created_at DESC')
		.all(sessionId) as SessionArtifact[];
}
