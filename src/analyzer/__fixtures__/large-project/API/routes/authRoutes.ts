import { login, refreshToken } from '../../Auth/index';
import { rateLimit } from '../middleware/rateLimiter';
import { toResult, toError, AppError } from '../../Shared/errors';
export function registerAuthRoutes(app: any) {
  app.post('/api/auth/login', rateLimit(5), async (req: any, res: any) => {
    try { const token = await login(req.body.email, req.body.password); res.json(toResult(token)); }
    catch (e) { res.statusCode = 401; res.json(toError(e as AppError)); }
  });
  app.post('/api/auth/refresh', async (req: any, res: any) => {
    const newToken = refreshToken(req.body.token);
    if (!newToken) { res.statusCode = 401; res.json({ ok: false, error: 'Invalid refresh token' }); return; }
    res.json(toResult(newToken));
  });
}
