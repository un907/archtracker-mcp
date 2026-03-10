import { verifyToken, validateApiKey } from '../../Auth/index';
import { AuthError } from '../../Shared/errors';
import { warn } from '../../Shared/logger';
export function authenticate(req: any, res: any, next: any) {
  const token = req.headers?.authorization?.replace('Bearer ', '');
  if (!token) { warn('No auth token'); throw new AuthError('No token provided'); }
  const user = verifyToken(token);
  if (!user) { throw new AuthError('Invalid token'); }
  req.user = user;
  next();
}
export async function authenticateApiKey(req: any, res: any, next: any) {
  const key = req.headers?.['x-api-key'];
  if (!key) throw new AuthError('No API key');
  req.user = await validateApiKey(key);
  next();
}
