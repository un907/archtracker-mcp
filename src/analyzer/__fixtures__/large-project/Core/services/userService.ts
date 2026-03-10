import { User } from '../types';
import { validateUser, sanitizeUser } from '../models/User';
import { UserRepository } from '../../Storage/repositories/userRepo';
import { cache } from '../../Storage/cache';
import { emit } from '../events/eventBus';
import { NotFoundError } from '../../Shared/errors';
import { info } from '../../Shared/logger';
import { ID } from '../../Shared/types';

const repo = new UserRepository();
export async function getUser(id: ID): Promise<User> {
  const entity = await repo.findById(id);
  if (!entity) throw new NotFoundError('User', id);
  return entity as unknown as User;
}
export async function createUser(data: Partial<User>): Promise<User> {
  validateUser(data);
  const entity = await repo.create(data as any);
  emit('user.registered', entity);
  info('User created: ' + entity.id);
  return entity as unknown as User;
}
export async function updateUser(id: ID, data: Partial<User>): Promise<User> {
  const entity = await repo.update(id, data as any);
  return entity as unknown as User;
}
export async function listUsers(page: number = 1) { return repo.findAll({ offset: (page - 1) * 20, limit: 20 }); }
