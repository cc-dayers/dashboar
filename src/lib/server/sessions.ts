import { randomUUID } from 'node:crypto';
import {
	deleteSessionRow,
	getSession,
	insertArtifact,
	insertLog,
	insertSession,
	listArtifacts,
	listLogs,
	listSessions,
	patchSession
} from './db';
import { readConfig } from './config';
import { createWorktree, getWorktreeDiff, removeWorktree } from './worktree';
import { emitLog } from './events';
import { getSessionPid, isPidRunning, startAgentProcess, stopAgentProcess } from './agent-runner';
import { DEFAULT_LOG_LIMIT } from './constants';
import type {
	AgentSession,
	CreateSessionInput,
	SessionStatus,
	UpdateSessionInput
} from './types';

export async function createSession(input: CreateSessionInput) {
	const config = readConfig();
	const repoPath = input.repoPath ?? config.repoPath;
	const baseBranch = input.baseBranch?.trim() || config.defaultBaseBranch;
	const branch = input.branch.trim();
	const worktreePath = await createWorktree(repoPath, config.worktreeBaseDir, branch, baseBranch);

	const session = insertSession({
		id: randomUUID(),
		name: input.name.trim() || branch,
		task: input.task.trim(),
		status: input.autoStart ? 'running' : 'pending',
		worktree_path: worktreePath,
		branch,
		base_branch: baseBranch,
		repo_path: repoPath,
		pid: null,
		model: input.model?.trim() || config.defaultModel
	});

	if (!session) {
		throw new Error('Failed to create session record');
	}

	insertAndEmitLog(session.id, 'system', `Session created for branch "${session.branch}"`);

	if (input.autoStart) {
		await startSession(session.id);
	}

	return getSessionDetail(session.id);
}

function insertAndEmitLog(sessionId: string, level: 'stdout' | 'stderr' | 'system', message: string) {
	const log = insertLog(sessionId, level, message);
	emitLog(log);
	return log;
}

export function listAllSessions(status?: SessionStatus) {
	return listSessions(status);
}

export function getSessionDetail(id: string) {
	const session = getSession(id);
	if (!session) return null;
	return {
		session,
		logs: listLogs(id, 200, 0),
		artifacts: listArtifacts(id)
	};
}

export function updateSession(id: string, updates: UpdateSessionInput) {
	return patchSession(id, updates);
}

export async function startSession(id: string) {
	const session = getSession(id);
	if (!session) throw new Error('Session not found');
	if (session.status === 'running') return session;
	const config = readConfig();

	const runningCount = listSessions('running').length;
	if (runningCount >= config.maxConcurrentSessions) {
		throw new Error(`Max concurrent sessions reached (${config.maxConcurrentSessions})`);
	}

	const pid = startAgentProcess({
		session,
		config,
		onLog: (level, message) => {
			insertAndEmitLog(id, level, message);
		},
		onExit: (status, message, processId) => {
			patchSession(id, { status, pid: processId });
			insertAndEmitLog(id, 'system', message);
		}
	});

	const updated = patchSession(id, { status: 'running', pid });
	insertAndEmitLog(id, 'system', `Agent process started${pid ? ` (pid ${pid})` : ''}`);
	return updated;
}

export function stopSession(id: string) {
	const session = getSession(id);
	if (!session) throw new Error('Session not found');

	const stopped = stopAgentProcess(id);
	const nextStatus = stopped ? 'paused' : session.status;
	const updated = patchSession(id, { status: nextStatus, pid: getSessionPid(id) });
	insertAndEmitLog(id, 'system', stopped ? 'Stop signal sent to agent process' : 'No running process found');
	return updated;
}

export async function deleteSession(id: string) {
	const session = getSession(id);
	if (!session) return false;
	stopAgentProcess(id);
	await removeWorktree(session.repo_path, session.worktree_path);
	deleteSessionRow(id);
	return true;
}

export function getSessionLogs(id: string, limit = DEFAULT_LOG_LIMIT, offset = 0) {
	return listLogs(id, limit, offset);
}

export async function getSessionDiff(id: string) {
	const session = getSession(id);
	if (!session) throw new Error('Session not found');
	const diff = await getWorktreeDiff(session.worktree_path);
	insertArtifact(id, 'diff', diff);
	return diff;
}

export function getPidStatus(pid: number) {
	return isPidRunning(pid);
}

export function listSessionArtifacts(id: string) {
	return listArtifacts(id);
}
