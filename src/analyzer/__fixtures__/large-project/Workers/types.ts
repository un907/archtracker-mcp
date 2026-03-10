import { Job } from '../Shared/queue';
export type WorkerStatus = 'idle' | 'running' | 'stopped' | 'error';
export interface WorkerConfig { concurrency: number; pollInterval: number; maxRetries: number; }
export interface WorkerResult { processed: number; failed: number; duration: number; }
