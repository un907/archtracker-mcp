import { loadConfig } from '../Shared/config';
import { CACHE_TTL } from '../Shared/constants';
import { debug } from '../Shared/logger';
export class CacheStore {
  private store = new Map<string, { value: unknown; expires: number }>();
  async get<T>(key: string): Promise<T | null> { debug('Cache GET: ' + key); const entry = this.store.get(key); if (!entry || entry.expires < Date.now()) return null; return entry.value as T; }
  async set(key: string, value: unknown, ttl: number = CACHE_TTL) { this.store.set(key, { value, expires: Date.now() + ttl * 1000 }); }
  async invalidate(pattern: string) { for (const key of this.store.keys()) { if (key.includes(pattern)) this.store.delete(key); } }
}
export const cache = new CacheStore();
