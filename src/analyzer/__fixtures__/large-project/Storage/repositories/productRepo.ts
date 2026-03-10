import { Entity, Repository, QueryOptions } from '../types';
import { db } from '../connection';
import { cache } from '../cache';
import { ID } from '../../Shared/types';
export interface ProductEntity extends Entity { name: string; price: number; category: string; stock: number; }
export class ProductRepository implements Repository<ProductEntity> {
  async findById(id: ID) { return (await db.query<ProductEntity>('SELECT * FROM products WHERE id = ?', [id]))[0] || null; }
  async findAll(opts?: QueryOptions) { return db.query<ProductEntity>('SELECT * FROM products'); }
  async findByCategory(cat: string) { return db.query<ProductEntity>('SELECT * FROM products WHERE category = ?', [cat]); }
  async create(data: Partial<ProductEntity>) { return {} as ProductEntity; }
  async update(id: ID, data: Partial<ProductEntity>) { await cache.invalidate('product:'); return {} as ProductEntity; }
  async delete(id: ID) { }
}
