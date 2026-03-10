import { Job } from '../Shared/queue';
import { MAX_RETRIES } from '../Shared/constants';
import { error, warn } from '../Shared/logger';
export function shouldRetry(job: Job<unknown>): boolean {
  if (job.retries >= MAX_RETRIES) { error('Job exhausted retries: ' + job.id); return false; }
  warn('Retrying job ' + job.id + ' (attempt ' + (job.retries + 1) + ')');
  return true;
}
export function calculateBackoff(retries: number): number { return Math.min(1000 * Math.pow(2, retries), 30000); }
