import { json } from '@sveltejs/kit';
import { getSessionLogs } from '$lib/server/sessions';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params, url }) => {
	const limit = Number(url.searchParams.get('limit') ?? 200);
	const offset = Number(url.searchParams.get('offset') ?? 0);
	const logs = getSessionLogs(
		params.id,
		Number.isNaN(limit) ? 200 : Math.min(Math.max(limit, 1), 1000),
		Number.isNaN(offset) ? 0 : Math.max(offset, 0)
	);
	return json({ logs });
};
