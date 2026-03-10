import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Dashboard } from './Dashboard';
import { Modal } from './Modal';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
export function App() {
  const auth = useAuth();
  const theme = useTheme();
  return { Header, Sidebar, Dashboard, Modal, auth, theme };
}
