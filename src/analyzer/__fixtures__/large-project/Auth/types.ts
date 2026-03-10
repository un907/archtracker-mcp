import { ID } from '../Shared/types';
export interface AuthToken { token: string; expiresAt: number; refreshToken?: string; }
export interface AuthUser { id: ID; email: string; role: string; permissions: string[]; }
export interface AuthProvider { authenticate(credentials: unknown): Promise<AuthUser | null>; }
export type Permission = 'read' | 'write' | 'admin' | 'superadmin';
