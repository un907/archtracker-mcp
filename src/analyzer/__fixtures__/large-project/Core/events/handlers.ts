import { on } from './eventBus';
import { createNotification, NotificationTypes } from '../models/Notification';
import { info } from '../../Shared/logger';
export function registerEventHandlers() {
  on('order.confirmed', (payload) => { info('Order confirmed event'); });
  on('order.shipped', (payload) => { info('Order shipped event'); });
  on('user.registered', (payload) => { info('User registered event'); });
  on('product.lowStock', (payload) => { info('Low stock alert'); });
}
