import { MAX_RETRIES } from './constants';
import { error, info } from './logger';
export interface Job<T> { id: string; type: string; payload: T; retries: number; }
export class Queue<T> {
  private jobs: Job<T>[] = [];
  enqueue(job: Job<T>) { this.jobs.push(job); info('Job enqueued: ' + job.type); }
  dequeue(): Job<T> | undefined { return this.jobs.shift(); }
  retry(job: Job<T>) { if (job.retries < MAX_RETRIES) { job.retries++; this.enqueue(job); } else { error('Job failed after max retries: ' + job.type); } }
}
