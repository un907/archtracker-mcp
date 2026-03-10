import { ID, Timestamp, PaginatedResult } from '../Shared/types';
export interface User { id: ID; email: string; name: string; role: string; createdAt: Timestamp; }
export interface Product { id: ID; name: string; price: number; category: string; stock: number; }
export interface Order { id: ID; userId: ID; items: OrderItem[]; total: number; status: OrderStatus; }
export interface OrderItem { productId: ID; quantity: number; price: number; }
export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
export interface Notification { id: ID; userId: ID; type: string; message: string; read: boolean; }
export interface SearchQuery { term: string; filters: Record<string, string>; page: number; limit: number; }
