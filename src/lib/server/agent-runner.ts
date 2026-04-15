import { spawn } from 'node:child_process';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import type { AgentSession, AppConfig, LogLevel, SessionStatus } from './types';

const sessionProcesses = new Map<string, ChildProcessWithoutNullStreams>();

function splitLines(chunk: Buffer | string) {
	return chunk
		.toString()
		.split(/\r?\n/)
		.map((line: string) => line.trimEnd())
		.filter(Boolean);
}

export function getSessionPid(sessionId: string) {
	return sessionProcesses.get(sessionId)?.pid ?? null;
}

export function stopAgentProcess(sessionId: string) {
	const child = sessionProcesses.get(sessionId);
	if (!child) return false;
	child.kill('SIGTERM');
	return true;
}

export function isPidRunning(pid: number) {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

type StartAgentOptions = {
	session: AgentSession;
	config: AppConfig;
	onLog: (level: LogLevel, message: string) => void;
	onExit: (status: SessionStatus, message: string, pid: number | null) => void;
};

export function startAgentProcess({ session, config, onLog, onExit }: StartAgentOptions) {
	const env = {
		...process.env,
		DASHBOAR_SESSION_ID: session.id,
		DASHBOAR_TASK: session.task,
		DASHBOAR_MODEL: session.model,
		DASHBOAR_WORKTREE: session.worktree_path
	};

	const child = spawn(config.agentCliCommand, config.agentCliArgs, {
		cwd: session.worktree_path,
		env,
		stdio: 'pipe'
	});

	sessionProcesses.set(session.id, child);

	child.stdout.on('data', (chunk: Buffer) => {
		for (const line of splitLines(chunk)) onLog('stdout', line);
	});
	child.stderr.on('data', (chunk: Buffer) => {
		for (const line of splitLines(chunk)) onLog('stderr', line);
	});

	child.once('error', (error: Error) => {
		onExit('failed', `Agent process failed: ${error.message}`, null);
		sessionProcesses.delete(session.id);
	});

	child.once('exit', (code: number | null, signal: NodeJS.Signals | null) => {
		const status: SessionStatus = code === 0 ? 'completed' : 'failed';
		const message =
			code === 0
				? 'Agent process completed successfully'
				: `Agent process exited with code ${code ?? 'unknown'}${signal ? ` (signal: ${signal})` : ''}`;
		onExit(status, message, null);
		sessionProcesses.delete(session.id);
	});

	return child.pid ?? null;
}
