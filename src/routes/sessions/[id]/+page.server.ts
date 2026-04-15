import { error } from '@sveltejs/kit';
import { getSessionDetail } from '$lib/server/sessions';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const detail = getSessionDetail(params.id);
	if (!detail) throw error(404, 'Session not found');
	return detail;
};
