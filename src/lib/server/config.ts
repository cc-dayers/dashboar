import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AppConfig } from './types';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'dashboar');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function defaultConfig(): AppConfig {
	const repoPath = process.env.DASHBOAR_REPO_PATH ?? process.cwd();
	return {
		repoPath,
		worktreeBaseDir: process.env.DASHBOAR_WORKTREE_DIR ?? path.join(repoPath, '.worktrees'),
		defaultBaseBranch: process.env.DASHBOAR_BASE_BRANCH ?? 'main',
		defaultModel: process.env.DASHBOAR_DEFAULT_MODEL ?? 'default',
		maxConcurrentSessions: Number(process.env.DASHBOAR_MAX_CONCURRENT ?? 3),
		logRetentionDays: Number(process.env.DASHBOAR_LOG_RETENTION_DAYS ?? 14),
		agentCliCommand: process.env.DASHBOAR_AGENT_COMMAND ?? 'bash',
		agentCliArgs: process.env.DASHBOAR_AGENT_ARGS
			? process.env.DASHBOAR_AGENT_ARGS.split(' ')
			: ['-lc', 'echo "agent started: $DASHBOAR_TASK"; sleep 1; echo "agent finished"']
	};
}

function mergeConfig(input: Partial<AppConfig>): AppConfig {
	const base = defaultConfig();
	return {
		...base,
		...input,
		agentCliArgs: Array.isArray(input.agentCliArgs) ? input.agentCliArgs : base.agentCliArgs
	};
}

export function readConfig(): AppConfig {
	const envBacked = defaultConfig();
	if (!existsSync(CONFIG_FILE)) {
		return envBacked;
	}

	try {
		const parsed = JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) as Partial<AppConfig>;
		return mergeConfig(parsed);
	} catch {
		return envBacked;
	}
}

export function writeConfig(input: Partial<AppConfig>): AppConfig {
	mkdirSync(CONFIG_DIR, { recursive: true });
	const next = mergeConfig(input);
	writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2), 'utf8');
	return next;
}

export function getConfigPath() {
	return CONFIG_FILE;
}
