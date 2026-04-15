import { json } from '@sveltejs/kit';
import { createSession, listAllSessions } from '$lib/server/sessions';
import type { RequestHandler } from './$types';
import type { SessionStatus } from '$lib/server/types';

export const GET: RequestHandler = ({ url }) => {
	const rawStatus = url.searchParams.get('status');
	const status =
		rawStatus === 'pending' ||
		rawStatus === 'running' ||
		rawStatus === 'paused' ||
		rawStatus === 'completed' ||
		rawStatus === 'failed'
			? (rawStatus as SessionStatus)
			: undefined;

	return json({ sessions: listAllSessions(status) });
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as Record<string, unknown>;
		const created = await createSession({
			name: typeof body.name === 'string' ? body.name : '',
			task: typeof body.task === 'string' ? body.task : '',
			branch: typeof body.branch === 'string' ? body.branch : '',
			baseBranch: typeof body.baseBranch === 'string' ? body.baseBranch : undefined,
			model: typeof body.model === 'string' ? body.model : undefined,
			autoStart: body.autoStart === true,
			repoPath: typeof body.repoPath === 'string' ? body.repoPath : undefined
		});

		return json(created, { status: 201 });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to create session';
		return json({ error: message }, { status: 400 });
	}
};
