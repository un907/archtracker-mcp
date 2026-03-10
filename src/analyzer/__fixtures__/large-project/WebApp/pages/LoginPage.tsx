import { useAuth } from '../hooks/useAuth';
import { validateEmail, validatePassword, validateRequired } from '../utils/validation';
import { info } from '../../Shared/logger';
export function LoginPage() {
  const auth = useAuth();
  async function handleLogin(email: string, password: string) {
    validateRequired(email, 'email');
    validateRequired(password, 'password');
    if (!validateEmail(email)) return;
    await auth.signIn(email, password);
    info('Login successful');
  }
  return { handleLogin, auth };
}
