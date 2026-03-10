import { analyticsQueue } from './jobQueue';
import { trackEvent } from '../Core/services/analyticsService';
import { shouldRetry } from './retryHandler';
import { info } from '../Shared/logger';
import { WorkerResult } from './types';
export async function processAnalyticsQueue(): Promise<WorkerResult> {
  let processed = 0, failed = 0;
  const start = Date.now();
  let job = analyticsQueue.dequeue();
  while (job) {
    try {
      await trackEvent(job.payload.event, job.payload.data as any);
      processed++;
    } catch (e) {
      if (shouldRetry(job)) analyticsQueue.retry(job);
      else failed++;
    }
    job = analyticsQueue.dequeue();
  }
  return { processed, failed, duration: Date.now() - start };
}
