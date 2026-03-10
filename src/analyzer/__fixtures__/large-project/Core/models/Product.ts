import { Product } from '../types';
import { ValidationError } from '../../Shared/errors';
export function validateProduct(data: Partial<Product>): void {
  if (!data.name) throw new ValidationError('name', 'Required');
  if (data.price != null && data.price < 0) throw new ValidationError('price', 'Must be non-negative');
  if (data.stock != null && data.stock < 0) throw new ValidationError('stock', 'Must be non-negative');
}
export function formatPrice(price: number): string { return '$' + price.toFixed(2); }
export function isInStock(product: Product): boolean { return product.stock > 0; }
