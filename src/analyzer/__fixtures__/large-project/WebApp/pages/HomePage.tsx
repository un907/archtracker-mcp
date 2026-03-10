import { Dashboard } from '../components/Dashboard';
import { NotificationPanel } from '../components/NotificationPanel';
import { useAuth } from '../hooks/useAuth';
export function HomePage() {
  const auth = useAuth();
  return { Dashboard, NotificationPanel, auth };
}
