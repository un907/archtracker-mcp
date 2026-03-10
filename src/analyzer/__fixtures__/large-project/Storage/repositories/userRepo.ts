import { Entity, Repository, QueryOptions } from '../types';
import { db } from '../connection';
import { cache } from '../cache';
import { ID } from '../../Shared/types';
export interface UserEntity extends Entity { email: string; name: string; role: string; passwordHash: string; }
export class UserRepository implements Repository<UserEntity> {
  async findById(id: ID) { const cached = await cache.get<UserEntity>('user:' + id); if (cached) return cached; const rows = await db.query<UserEntity>('SELECT * FROM users WHERE id = ?', [id]); return rows[0] || null; }
  async findAll(opts?: QueryOptions) { return db.query<UserEntity>('SELECT * FROM users'); }
  async findByEmail(email: string) { return db.query<UserEntity>('SELECT * FROM users WHERE email = ?', [email]); }
  async create(data: Partial<UserEntity>) { return {} as UserEntity; }
  async update(id: ID, data: Partial<UserEntity>) { await cache.invalidate('user:' + id); return {} as UserEntity; }
  async delete(id: ID) { await cache.invalidate('user:' + id); }
}
