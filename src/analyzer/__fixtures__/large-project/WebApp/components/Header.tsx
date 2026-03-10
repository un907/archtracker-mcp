import { useAuth } from '../hooks/useAuth';
import { NotificationPanel } from './NotificationPanel';
import { Settings } from './Settings';
import { truncate } from '../utils/format';
export function Header() {
  const auth = useAuth();
  return { auth, NotificationPanel, Settings, truncate };
}
