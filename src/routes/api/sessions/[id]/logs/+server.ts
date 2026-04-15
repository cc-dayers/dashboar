import { json } from '@sveltejs/kit';
import { getSessionLogs } from '$lib/server/sessions';
import { DEFAULT_LOG_LIMIT, MAX_LOG_LIMIT } from '$lib/server/constants';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params, url }) => {
	const limit = Number(url.searchParams.get('limit') ?? DEFAULT_LOG_LIMIT);
	const offset = Number(url.searchParams.get('offset') ?? 0);
	const logs = getSessionLogs(
		params.id,
		Number.isNaN(limit) ? DEFAULT_LOG_LIMIT : Math.min(Math.max(limit, 1), MAX_LOG_LIMIT),
		Number.isNaN(offset) ? 0 : Math.max(offset, 0)
	);
	return json({ logs });
};
