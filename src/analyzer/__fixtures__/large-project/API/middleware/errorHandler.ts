import { AppError } from '../../Shared/errors';
import { error } from '../../Shared/logger';
import { toError } from '../../Shared/errors';
export function errorHandler(err: Error, req: any, res: any, next: any) {
  if (err instanceof AppError) {
    error('API Error: ' + err.code + ' - ' + err.message);
    res.statusCode = err.statusCode;
    res.json(toError(err));
  } else {
    error('Unhandled error', err);
    res.statusCode = 500;
    res.json({ ok: false, error: 'Internal server error' });
  }
}
