import { AuthUser } from '../types';
import { AuthError } from '../../Shared/errors';
import { hash, verify } from '../../Shared/crypto';
import { db } from '../../Storage/connection';
export async function validateApiKey(key: string): Promise<AuthUser> {
  const rows = await db.query<{ userId: string; keyHash: string }>('SELECT * FROM api_keys WHERE active = true');
  const match = rows.find(r => verify(key, r.keyHash));
  if (!match) throw new AuthError('Invalid API key');
  return { id: match.userId, email: '', role: 'api', permissions: ['read'] };
}
