import { Entity, Repository } from '../types';
import { db } from '../connection';
import { ID } from '../../Shared/types';
export interface NotificationEntity extends Entity { userId: ID; type: string; message: string; read: boolean; }
export class NotificationRepository implements Repository<NotificationEntity> {
  async findById(id: ID) { return (await db.query<NotificationEntity>('SELECT * FROM notifications WHERE id = ?', [id]))[0] || null; }
  async findAll() { return db.query<NotificationEntity>('SELECT * FROM notifications'); }
  async findUnread(userId: ID) { return db.query<NotificationEntity>('SELECT * FROM notifications WHERE userId = ? AND read = false', [userId]); }
  async create(data: Partial<NotificationEntity>) { return {} as NotificationEntity; }
  async update(id: ID, data: Partial<NotificationEntity>) { return {} as NotificationEntity; }
  async delete(id: ID) { }
  async markAllRead(userId: ID) { await db.query('UPDATE notifications SET read = true WHERE userId = ?', [userId]); }
}
