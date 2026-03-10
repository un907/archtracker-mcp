import { AuthUser, AuthProvider } from '../types';
import { httpGet, httpPost } from '../../Shared/http';
import { info } from '../../Shared/logger';
export class OAuthProvider implements AuthProvider {
  constructor(private clientId: string, private clientSecret: string, private redirectUri: string) {}
  async authenticate(code: unknown): Promise<AuthUser | null> {
    info('OAuth authentication attempt');
    const tokenResult = await httpPost('https://oauth.provider/token', { code, client_id: this.clientId });
    if (!tokenResult.ok) return null;
    const userResult = await httpGet<AuthUser>('https://oauth.provider/userinfo');
    return userResult.data || null;
  }
}
