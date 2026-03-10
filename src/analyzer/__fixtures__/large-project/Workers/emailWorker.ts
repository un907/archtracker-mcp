import { emailQueue } from './jobQueue';
import { shouldRetry, calculateBackoff } from './retryHandler';
import { httpPost } from '../Shared/http';
import { info, error } from '../Shared/logger';
import { WorkerResult } from './types';
export async function processEmailQueue(): Promise<WorkerResult> {
  let processed = 0, failed = 0;
  const start = Date.now();
  let job = emailQueue.dequeue();
  while (job) {
    try {
      await httpPost('https://email-service/send', job.payload);
      info('Email sent: ' + job.payload.to);
      processed++;
    } catch (e) {
      if (shouldRetry(job)) { emailQueue.retry(job); }
      else { failed++; error('Email failed permanently: ' + job.id); }
    }
    job = emailQueue.dequeue();
  }
  return { processed, failed, duration: Date.now() - start };
}
