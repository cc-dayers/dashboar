import { subscribeLogs } from '$lib/server/events';
import { LOG_STREAM_HEARTBEAT_MS } from '$lib/server/constants';
import type { SessionLog } from '$lib/server/types';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params }) => {
	const sessionId = params.id;
	const encoder = new TextEncoder();
	let unsubscribe = () => {};
	let heartbeat: ReturnType<typeof setInterval> | null = null;

	const stream = new ReadableStream({
		start(controller) {
			controller.enqueue(encoder.encode('retry: 1000\n\n'));

			const send = (log: SessionLog) => {
				controller.enqueue(encoder.encode(`data: ${JSON.stringify(log)}\n\n`));
			};

			unsubscribe = subscribeLogs(sessionId, send);
			heartbeat = setInterval(() => {
				controller.enqueue(encoder.encode(': keep-alive\n\n'));
			}, LOG_STREAM_HEARTBEAT_MS);
		},
		cancel() {
			if (heartbeat) clearInterval(heartbeat);
			unsubscribe();
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
