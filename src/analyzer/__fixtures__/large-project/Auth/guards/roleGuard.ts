import { AuthUser, Permission } from '../types';
import { AuthError } from '../../Shared/errors';
import { warn } from '../../Shared/logger';
export function requireRole(user: AuthUser, ...roles: string[]): void {
  if (!roles.includes(user.role)) { warn('Role denied: ' + user.role + ' not in ' + roles.join(',')); throw new AuthError('Insufficient role'); }
}
export function requirePermission(user: AuthUser, permission: Permission): void {
  if (!user.permissions.includes(permission)) { throw new AuthError('Missing permission: ' + permission); }
}
export function isAdmin(user: AuthUser): boolean { return user.role === 'admin' || user.role === 'superadmin'; }
