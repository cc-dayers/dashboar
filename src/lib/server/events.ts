import { EventEmitter } from 'node:events';
import type { SessionLog } from './types';

const emitter = new EventEmitter();

export function emitLog(log: SessionLog) {
	emitter.emit(`log:${log.session_id}`, log);
}

export function subscribeLogs(sessionId: string, listener: (log: SessionLog) => void) {
	const event = `log:${sessionId}`;
	emitter.on(event, listener);
	return () => emitter.off(event, listener);
}
