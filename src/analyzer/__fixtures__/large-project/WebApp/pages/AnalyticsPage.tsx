import { useApi } from '../hooks/useApi';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency, formatDate, pageCount } from '../utils/format';
import { AnalyticsData } from '../../Core/services/analyticsService';
export function AnalyticsPage() {
  const api = useApi();
  const auth = useAuth();
  async function loadDashboard() { return api.get<AnalyticsData>('/analytics/dashboard'); }
  async function trackPageView() { await api.post('/analytics/track', { event: 'page_view', meta: { page: 'analytics' } }); }
  return { loadDashboard, trackPageView, formatCurrency, formatDate, pageCount };
}
