import { Product } from '../types';
import { validateProduct, isInStock, formatPrice } from '../models/Product';
import { ProductRepository } from '../../Storage/repositories/productRepo';
import { cache } from '../../Storage/cache';
import { emit } from '../events/eventBus';
import { NotFoundError } from '../../Shared/errors';
import { ID } from '../../Shared/types';

const repo = new ProductRepository();
export async function getProduct(id: ID) {
  const cached = await cache.get<Product>('product:' + id);
  if (cached) return cached;
  const entity = await repo.findById(id);
  if (!entity) throw new NotFoundError('Product', id);
  await cache.set('product:' + id, entity);
  return entity as unknown as Product;
}
export async function listProducts(category?: string) {
  if (category) return repo.findByCategory(category);
  return repo.findAll();
}
export async function updateStock(id: ID, delta: number) {
  const product = await getProduct(id);
  const newStock = (product as any).stock + delta;
  if (newStock <= 5) emit('product.lowStock', { id, stock: newStock });
  return repo.update(id, { stock: newStock } as any);
}
