import { cleanupQueue } from './jobQueue';
import { db } from '../Storage/connection';
import { cache } from '../Storage/cache';
import { info } from '../Shared/logger';
import { WorkerResult } from './types';
export async function processCleanupQueue(): Promise<WorkerResult> {
  let processed = 0, failed = 0;
  const start = Date.now();
  let job = cleanupQueue.dequeue();
  while (job) {
    try {
      await db.query('DELETE FROM ' + job.payload.type + ' WHERE createdAt < ?', [job.payload.olderThan]);
      await cache.invalidate(job.payload.type);
      info('Cleanup done: ' + job.payload.type);
      processed++;
    } catch (e) { failed++; }
    job = cleanupQueue.dequeue();
  }
  return { processed, failed, duration: Date.now() - start };
}
