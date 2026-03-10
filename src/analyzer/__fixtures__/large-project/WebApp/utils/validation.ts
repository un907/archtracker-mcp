import { ValidationError } from '../../Shared/errors';
export function validateEmail(email: string): boolean { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
export function validatePassword(password: string): string[] {
  const errors: string[] = [];
  if (password.length < 8) errors.push('Must be at least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('Must contain uppercase');
  if (!/[0-9]/.test(password)) errors.push('Must contain a number');
  return errors;
}
export function validateRequired(value: unknown, field: string) {
  if (value == null || value === '') throw new ValidationError(field, 'Required');
}
