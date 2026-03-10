import { login, verifyToken, refreshToken } from '../../Auth/index';
import { AuthToken, AuthUser } from '../../Auth/types';
import { info } from '../../Shared/logger';
export function useAuth() {
  let currentUser: AuthUser | null = null;
  let token: AuthToken | null = null;
  async function signIn(email: string, password: string) {
    token = await login(email, password);
    currentUser = verifyToken(token.token);
    info('User signed in');
  }
  function signOut() { currentUser = null; token = null; }
  function isAuthenticated() { return currentUser !== null; }
  return { currentUser, signIn, signOut, isAuthenticated };
}
