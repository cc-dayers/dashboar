import { json } from '@sveltejs/kit';
import { readConfig } from '$lib/server/config';
import { listWorktrees } from '$lib/server/worktree';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const config = readConfig();
		const repoPath = url.searchParams.get('repoPath') ?? config.repoPath;
		const worktrees = await listWorktrees(repoPath);
		return json({ repoPath, worktrees });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to list worktrees';
		return json({ error: message }, { status: 500 });
	}
};
