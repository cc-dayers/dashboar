import { json } from '@sveltejs/kit';
import { stopSession } from '$lib/server/sessions';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ params }) => {
	try {
		const session = stopSession(params.id);
		return json({ session });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to stop session';
		return json({ error: message }, { status: 400 });
	}
};
