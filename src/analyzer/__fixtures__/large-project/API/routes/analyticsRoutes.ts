import { handleDashboard, handleTrackEvent } from '../controllers/analyticsController';
import { authenticate } from '../middleware/authMiddleware';
import { rateLimit } from '../middleware/rateLimiter';
export function registerAnalyticsRoutes(app: any) {
  app.get('/api/analytics/dashboard', authenticate, handleDashboard);
  app.post('/api/analytics/track', rateLimit(500), handleTrackEvent);
}
