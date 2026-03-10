import { useApi } from '../hooks/useApi';
import { useAuth } from '../hooks/useAuth';
import { formatDate, truncate } from '../utils/format';
import { Notification } from '../../Core/types';
export function NotificationPanel() {
  const api = useApi();
  const auth = useAuth();
  async function loadNotifications() {
    return api.get<Notification[]>('/notifications/unread');
  }
  async function markAllRead() { return api.post('/notifications/read-all', {}); }
  return { loadNotifications, markAllRead, formatDate, truncate };
}
