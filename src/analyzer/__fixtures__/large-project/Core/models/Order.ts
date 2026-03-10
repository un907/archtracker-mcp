import { Order, OrderItem, OrderStatus } from '../types';
import { ValidationError } from '../../Shared/errors';
import { isInStock } from './Product';
export function calculateTotal(items: OrderItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}
export function validateOrder(order: Partial<Order>): void {
  if (!order.userId) throw new ValidationError('userId', 'Required');
  if (!order.items || order.items.length === 0) throw new ValidationError('items', 'Must have at least one item');
}
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  const transitions: Record<OrderStatus, OrderStatus[]> = { pending: ['confirmed', 'cancelled'], confirmed: ['shipped', 'cancelled'], shipped: ['delivered'], delivered: [], cancelled: [] };
  return transitions[from]?.includes(to) ?? false;
}
