import { getDashboardStats, trackEvent } from '../../Core/services/analyticsService';
import { requireRole } from '../../Auth/index';
import { toResult } from '../../Shared/errors';
export async function handleDashboard(req: any, res: any) {
  requireRole(req.user, 'admin');
  const stats = await getDashboardStats();
  res.json(toResult(stats));
}
export async function handleTrackEvent(req: any, res: any) {
  await trackEvent(req.body.event, req.body.meta || {});
  res.json({ ok: true });
}
