import { API_TIMEOUT, CACHE_TTL, RATE_LIMIT_WINDOW } from './constants';
export interface AppConfig { port: number; dbUrl: string; redisUrl: string; jwtSecret: string; apiTimeout: number; cacheTtl: number; }
export function loadConfig(): AppConfig {
  return { port: 3000, dbUrl: '', redisUrl: '', jwtSecret: '', apiTimeout: API_TIMEOUT, cacheTtl: CACHE_TTL };
}
