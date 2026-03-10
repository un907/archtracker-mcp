import { Queue, Job } from '../Shared/queue';
import { info, error } from '../Shared/logger';
import { MAX_RETRIES } from '../Shared/constants';
import { WorkerConfig } from './types';
export const emailQueue = new Queue<{ to: string; subject: string; body: string }>();
export const analyticsQueue = new Queue<{ event: string; data: unknown }>();
export const cleanupQueue = new Queue<{ type: string; olderThan: number }>();
export const syncQueue = new Queue<{ table: string; lastSync: number }>();
export function enqueueEmail(to: string, subject: string, body: string) {
  emailQueue.enqueue({ id: Date.now().toString(), type: 'email', payload: { to, subject, body }, retries: 0 });
  info('Email job enqueued for: ' + to);
}
