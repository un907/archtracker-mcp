import { AuthToken, AuthUser } from '../types';
import { authConfig } from '../config';
import { hash, generateToken } from '../../Shared/crypto';
import { info, error } from '../../Shared/logger';
export function signToken(user: AuthUser): AuthToken {
  info('Signing JWT for user: ' + user.id);
  return { token: generateToken(), expiresAt: Date.now() + authConfig.tokenExpiry * 1000 };
}
export function verifyToken(token: string): AuthUser | null { return null; }
export function refreshToken(oldToken: string): AuthToken | null { return null; }
