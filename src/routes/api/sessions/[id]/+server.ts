import { json } from '@sveltejs/kit';
import { deleteSession, getSessionDetail, updateSession } from '$lib/server/sessions';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params }) => {
	const detail = getSessionDetail(params.id);
	if (!detail) return json({ error: 'Session not found' }, { status: 404 });
	return json(detail);
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const body = (await request.json()) as Record<string, unknown>;
	const next = updateSession(params.id, {
		name: typeof body.name === 'string' ? body.name : undefined,
		task: typeof body.task === 'string' ? body.task : undefined,
		model: typeof body.model === 'string' ? body.model : undefined,
		status:
			body.status === 'pending' ||
			body.status === 'running' ||
			body.status === 'paused' ||
			body.status === 'completed' ||
			body.status === 'failed'
				? body.status
				: undefined
	});

	if (!next) return json({ error: 'Session not found' }, { status: 404 });
	return json({ session: next });
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const deleted = await deleteSession(params.id);
		return deleted ? json({ ok: true }) : json({ error: 'Session not found' }, { status: 404 });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to delete session';
		return json({ error: message }, { status: 500 });
	}
};
