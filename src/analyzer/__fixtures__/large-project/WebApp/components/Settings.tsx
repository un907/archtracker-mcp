import { useTheme, Theme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
export function Settings() {
  const theme = useTheme();
  const auth = useAuth();
  function changeTheme(t: Theme) { theme.setTheme(t); }
  return { theme, auth, changeTheme };
}
