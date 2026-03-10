import { info, debug } from '../../Shared/logger';
type Handler = (payload: unknown) => void | Promise<void>;
const listeners = new Map<string, Handler[]>();
export function emit(event: string, payload: unknown) { info('Event: ' + event); (listeners.get(event) || []).forEach(h => h(payload)); }
export function on(event: string, handler: Handler) { if (!listeners.has(event)) listeners.set(event, []); listeners.get(event)!.push(handler); debug('Handler registered for: ' + event); }
export function off(event: string, handler: Handler) { const h = listeners.get(event); if (h) listeners.set(event, h.filter(x => x !== handler)); }
export function once(event: string, handler: Handler) { const wrapper: Handler = (p) => { off(event, wrapper); handler(p); }; on(event, wrapper); }
