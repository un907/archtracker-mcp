import { syncQueue } from './jobQueue';
import { db } from '../Storage/connection';
import { cache } from '../Storage/cache';
import { httpPost } from '../Shared/http';
import { shouldRetry } from './retryHandler';
import { info, error } from '../Shared/logger';
import { WorkerResult } from './types';
export async function processSyncQueue(): Promise<WorkerResult> {
  let processed = 0, failed = 0;
  const start = Date.now();
  let job = syncQueue.dequeue();
  while (job) {
    try {
      const rows = await db.query('SELECT * FROM ' + job.payload.table + ' WHERE updatedAt > ?', [job.payload.lastSync]);
      await httpPost('https://analytics-service/sync', { table: job.payload.table, rows });
      await cache.invalidate('sync:' + job.payload.table);
      info('Synced ' + rows.length + ' rows from ' + job.payload.table);
      processed++;
    } catch (e) {
      if (shouldRetry(job)) syncQueue.retry(job);
      else { failed++; error('Sync failed: ' + job.payload.table); }
    }
    job = syncQueue.dequeue();
  }
  return { processed, failed, duration: Date.now() - start };
}
