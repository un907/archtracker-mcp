import { info, debug } from '../Shared/logger';
import { WorkerConfig, WorkerStatus } from './types';
const tasks = new Map<string, { fn: () => Promise<void>; interval: number; timer?: any }>();
export function schedule(name: string, fn: () => Promise<void>, intervalMs: number) {
  info('Scheduling task: ' + name + ' every ' + intervalMs + 'ms');
  tasks.set(name, { fn, interval: intervalMs });
}
export function start(name: string) {
  const task = tasks.get(name); if (!task) return;
  task.timer = setInterval(() => { debug('Running scheduled: ' + name); task.fn().catch(() => {}); }, task.interval);
}
export function stop(name: string) { const task = tasks.get(name); if (task?.timer) clearInterval(task.timer); }
export function stopAll() { tasks.forEach((_, name) => stop(name)); }
