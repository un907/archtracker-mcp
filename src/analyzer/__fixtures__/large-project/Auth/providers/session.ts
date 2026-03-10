import { AuthUser } from '../types';
import { authConfig } from '../config';
import { cache } from '../../Storage/cache';
import { generateToken } from '../../Shared/crypto';
import { debug } from '../../Shared/logger';
export async function createSession(user: AuthUser): Promise<string> {
  const sessionId = generateToken();
  await cache.set('session:' + sessionId, user, authConfig.sessionTtl);
  debug('Session created: ' + sessionId);
  return sessionId;
}
export async function getSession(sessionId: string): Promise<AuthUser | null> {
  return cache.get<AuthUser>('session:' + sessionId);
}
export async function destroySession(sessionId: string): Promise<void> {
  await cache.invalidate('session:' + sessionId);
}
