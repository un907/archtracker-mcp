import { Entity, Repository } from '../types';
import { db } from '../connection';
import { ID } from '../../Shared/types';
export interface OrderEntity extends Entity { userId: ID; items: { productId: ID; quantity: number; price: number }[]; total: number; status: string; }
export class OrderRepository implements Repository<OrderEntity> {
  async findById(id: ID) { return (await db.query<OrderEntity>('SELECT * FROM orders WHERE id = ?', [id]))[0] || null; }
  async findAll() { return db.query<OrderEntity>('SELECT * FROM orders'); }
  async findByUser(userId: ID) { return db.query<OrderEntity>('SELECT * FROM orders WHERE userId = ?', [userId]); }
  async create(data: Partial<OrderEntity>) { return {} as OrderEntity; }
  async update(id: ID, data: Partial<OrderEntity>) { return {} as OrderEntity; }
  async delete(id: ID) { }
}
