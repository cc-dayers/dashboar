import { json } from '@sveltejs/kit';
import { startSession } from '$lib/server/sessions';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params }) => {
	try {
		const session = await startSession(params.id);
		return json({ session });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to start session';
		return json({ error: message }, { status: 400 });
	}
};
