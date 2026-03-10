import { RATE_LIMIT_WINDOW } from '../../Shared/constants';
import { cache } from '../../Storage/cache';
import { warn } from '../../Shared/logger';
import { AppError } from '../../Shared/errors';
const requests = new Map<string, { count: number; resetAt: number }>();
export function rateLimit(maxRequests: number = 100) {
  return (req: any, res: any, next: any) => {
    const ip = req.ip || 'unknown';
    const entry = requests.get(ip);
    if (entry && entry.resetAt > Date.now()) {
      if (entry.count >= maxRequests) { warn('Rate limit exceeded: ' + ip); throw new AppError('RATE_LIMIT', 'Too many requests', 429); }
      entry.count++;
    } else { requests.set(ip, { count: 1, resetAt: Date.now() + RATE_LIMIT_WINDOW }); }
    next();
  };
}
