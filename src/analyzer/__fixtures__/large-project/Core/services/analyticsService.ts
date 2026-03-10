import { db } from '../../Storage/connection';
import { cache } from '../../Storage/cache';
import { info } from '../../Shared/logger';
import { CACHE_TTL } from '../../Shared/constants';
export interface AnalyticsData { totalUsers: number; totalOrders: number; revenue: number; topProducts: { name: string; count: number }[]; }
export async function getDashboardStats(): Promise<AnalyticsData> {
  const cached = await cache.get<AnalyticsData>('analytics:dashboard');
  if (cached) return cached;
  info('Computing dashboard analytics');
  const users = await db.query<{ count: number }>('SELECT COUNT(*) as count FROM users');
  const orders = await db.query<{ count: number; total: number }>('SELECT COUNT(*) as count, SUM(total) as total FROM orders');
  const data: AnalyticsData = { totalUsers: users[0]?.count || 0, totalOrders: orders[0]?.count || 0, revenue: orders[0]?.total || 0, topProducts: [] };
  await cache.set('analytics:dashboard', data, CACHE_TTL);
  return data;
}
export async function trackEvent(event: string, meta: Record<string, unknown>) { info('Analytics event: ' + event); }
