import { Result } from './types';
export class AppError extends Error { constructor(public code: string, message: string, public statusCode: number = 500) { super(message); } }
export class NotFoundError extends AppError { constructor(entity: string, id: string) { super('NOT_FOUND', entity + ' ' + id + ' not found', 404); } }
export class AuthError extends AppError { constructor(message: string) { super('AUTH_ERROR', message, 401); } }
export class ValidationError extends AppError { constructor(field: string, reason: string) { super('VALIDATION', field + ': ' + reason, 400); } }
export function toResult<T>(data: T): Result<T> { return { ok: true, data }; }
export function toError(err: AppError): Result<never> { return { ok: false, error: err.message }; }
