import { useApi } from '../hooks/useApi';
import { formatCurrency, formatDate } from '../utils/format';
import { AnalyticsData } from '../../Core/services/analyticsService';
export function Dashboard() {
  const api = useApi();
  async function loadStats() {
    const result = await api.get<AnalyticsData>('/analytics/dashboard');
    return result.data;
  }
  return { loadStats, formatCurrency, formatDate };
}
