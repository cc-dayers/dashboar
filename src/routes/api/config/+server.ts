import { json } from '@sveltejs/kit';
import { readConfig, writeConfig } from '$lib/server/config';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	return json(readConfig());
};

export const PUT: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as Record<string, unknown>;
	const next = writeConfig({
		repoPath: typeof body.repoPath === 'string' ? body.repoPath : undefined,
		worktreeBaseDir: typeof body.worktreeBaseDir === 'string' ? body.worktreeBaseDir : undefined,
		defaultBaseBranch: typeof body.defaultBaseBranch === 'string' ? body.defaultBaseBranch : undefined,
		defaultModel: typeof body.defaultModel === 'string' ? body.defaultModel : undefined,
		maxConcurrentSessions:
			typeof body.maxConcurrentSessions === 'number' ? body.maxConcurrentSessions : undefined,
		logRetentionDays: typeof body.logRetentionDays === 'number' ? body.logRetentionDays : undefined,
		agentCliCommand: typeof body.agentCliCommand === 'string' ? body.agentCliCommand : undefined,
		agentCliArgs: Array.isArray(body.agentCliArgs)
			? body.agentCliArgs.filter((value): value is string => typeof value === 'string')
			: undefined
	});
	return json(next);
};
