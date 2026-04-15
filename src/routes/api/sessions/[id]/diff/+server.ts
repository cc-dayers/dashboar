import { json } from '@sveltejs/kit';
import { getSessionDiff } from '$lib/server/sessions';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const diff = await getSessionDiff(params.id);
		return json({ diff });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to fetch diff';
		return json({ error: message }, { status: 400 });
	}
};
