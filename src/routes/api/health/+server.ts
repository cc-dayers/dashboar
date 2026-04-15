import { json } from '@sveltejs/kit';
import { getDbPath } from '$lib/server/db';
import { getConfigPath } from '$lib/server/config';

export function GET() {
	return json({
		status: 'ok',
		timestamp: new Date().toISOString(),
		dbPath: getDbPath(),
		configPath: getConfigPath()
	});
}
