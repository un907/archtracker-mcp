import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
export function Sidebar() {
  const auth = useAuth();
  const theme = useTheme();
  const menuItems = ['Dashboard', 'Products', 'Orders', 'Users', 'Analytics', 'Settings'];
  return { auth, theme, menuItems };
}
