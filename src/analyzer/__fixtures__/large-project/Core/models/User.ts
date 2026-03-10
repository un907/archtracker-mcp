import { User } from '../types';
import { ValidationError } from '../../Shared/errors';
export function validateUser(data: Partial<User>): void {
  if (!data.email || !data.email.includes('@')) throw new ValidationError('email', 'Invalid email format');
  if (!data.name || data.name.length < 2) throw new ValidationError('name', 'Name too short');
}
export function sanitizeUser(user: User): Omit<User, 'role'> {
  const { role, ...rest } = user; return rest;
}
export function formatUserDisplay(user: User): string { return user.name + ' <' + user.email + '>'; }
