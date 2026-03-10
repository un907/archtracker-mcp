import { loadConfig } from '../Shared/config';
import { CACHE_TTL } from '../Shared/constants';
export const authConfig = {
  jwtSecret: loadConfig().jwtSecret,
  tokenExpiry: 3600,
  refreshExpiry: 86400 * 7,
  sessionTtl: CACHE_TTL,
  maxLoginAttempts: 5,
  lockoutDuration: 900,
};
