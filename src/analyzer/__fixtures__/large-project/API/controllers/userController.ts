import { getUser, createUser, updateUser, listUsers } from '../../Core/services/userService';
import { requireRole } from '../../Auth/index';
import { toResult } from '../../Shared/errors';
import { info } from '../../Shared/logger';
export async function handleGetUser(req: any, res: any) {
  const user = await getUser(req.params.id);
  res.json(toResult(user));
}
export async function handleCreateUser(req: any, res: any) {
  const user = await createUser(req.body);
  info('User created via API');
  res.json(toResult(user));
}
export async function handleUpdateUser(req: any, res: any) {
  const user = await updateUser(req.params.id, req.body);
  res.json(toResult(user));
}
export async function handleListUsers(req: any, res: any) {
  requireRole(req.user, 'admin', 'superadmin');
  const users = await listUsers(req.query.page);
  res.json(toResult(users));
}
