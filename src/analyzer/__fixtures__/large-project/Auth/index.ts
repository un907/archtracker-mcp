import { AuthUser, AuthToken } from './types';
import { signToken, verifyToken, refreshToken } from './providers/jwt';
import { createSession, getSession, destroySession } from './providers/session';
import { requireRole, requirePermission } from './guards/roleGuard';
import { validateApiKey } from './guards/apiKeyGuard';
import { UserRepository } from '../Storage/repositories/userRepo';
import { verify } from '../Shared/crypto';
import { info, warn } from '../Shared/logger';
import { AuthError } from '../Shared/errors';

const userRepo = new UserRepository();
export async function login(email: string, password: string): Promise<AuthToken> {
  const users = await userRepo.findByEmail(email);
  if (users.length === 0) { warn('Login failed: unknown email'); throw new AuthError('Invalid credentials'); }
  const user = users[0];
  if (!verify(password, user.passwordHash)) { throw new AuthError('Invalid credentials'); }
  info('User logged in: ' + user.id);
  return signToken({ id: user.id, email: user.email, role: user.role, permissions: [] });
}
export { verifyToken, refreshToken, createSession, getSession, destroySession, requireRole, requirePermission, validateApiKey };
