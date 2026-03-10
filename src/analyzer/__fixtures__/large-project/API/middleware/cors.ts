import { loadConfig } from '../../Shared/config';
export function corsMiddleware(req: any, res: any, next: any) {
  const config = loadConfig();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Api-Key');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  next();
}
