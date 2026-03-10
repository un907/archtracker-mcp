import { useApi } from '../hooks/useApi';
import { useAuth } from '../hooks/useAuth';
import { validateEmail, validatePassword } from '../utils/validation';
import { formatDate } from '../utils/format';
export function UserProfile() {
  const api = useApi();
  const auth = useAuth();
  async function updateProfile(data: unknown) { return api.put('/users/' + auth.currentUser?.id, data); }
  function validateProfileForm(email: string, password: string) {
    const valid = validateEmail(email);
    const passwordErrors = validatePassword(password);
    return { valid, passwordErrors };
  }
  return { updateProfile, validateProfileForm, formatDate };
}
