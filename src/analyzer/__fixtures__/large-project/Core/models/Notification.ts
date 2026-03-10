import { Notification } from '../types';
import { ID } from '../../Shared/types';
export function createNotification(userId: ID, type: string, message: string): Partial<Notification> {
  return { userId, type, message, read: false };
}
export const NotificationTypes = { ORDER_CONFIRMED: 'order_confirmed', ORDER_SHIPPED: 'order_shipped', WELCOME: 'welcome', PRICE_DROP: 'price_drop', SYSTEM: 'system' } as const;
