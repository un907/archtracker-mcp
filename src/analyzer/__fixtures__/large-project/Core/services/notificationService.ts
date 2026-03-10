import { Notification } from '../types';
import { createNotification, NotificationTypes } from '../models/Notification';
import { NotificationRepository } from '../../Storage/repositories/notificationRepo';
import { ID } from '../../Shared/types';
import { info } from '../../Shared/logger';

const repo = new NotificationRepository();
export async function notify(userId: ID, type: string, message: string) {
  const data = createNotification(userId, type, message);
  const entity = await repo.create(data as any);
  info('Notification sent: ' + type + ' to ' + userId);
  return entity;
}
export async function getUnread(userId: ID) { return repo.findUnread(userId); }
export async function markAllRead(userId: ID) { await repo.markAllRead(userId); }
export async function sendWelcome(userId: ID) { return notify(userId, NotificationTypes.WELCOME, 'Welcome!'); }
export async function sendOrderUpdate(userId: ID, orderId: string, status: string) {
  return notify(userId, 'order_' + status, 'Order ' + orderId + ' is now ' + status);
}
