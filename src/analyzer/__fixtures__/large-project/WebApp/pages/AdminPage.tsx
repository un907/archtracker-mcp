import { useAuth } from '../hooks/useAuth';
import { useApi } from '../hooks/useApi';
import { requireRole } from '../../Auth/index';
import { formatDate, formatCurrency, pluralize } from '../utils/format';
export function AdminPage() {
  const auth = useAuth();
  const api = useApi();
  async function loadUsers() { return api.get('/users'); }
  async function loadOrders() { return api.get('/orders'); }
  return { loadUsers, loadOrders, formatDate, formatCurrency, pluralize };
}
