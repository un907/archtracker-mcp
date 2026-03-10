import { SearchQuery, User, Product } from '../types';
import { db } from '../../Storage/connection';
import { cache } from '../../Storage/cache';
import { PaginatedResult } from '../../Shared/types';
import { DEFAULT_PAGE_SIZE } from '../../Shared/constants';
import { debug } from '../../Shared/logger';

export async function searchUsers(query: SearchQuery): Promise<PaginatedResult<User>> {
  debug('Searching users: ' + query.term);
  const results = await db.query<User>('SELECT * FROM users WHERE name LIKE ?', ['%' + query.term + '%']);
  return { ok: true, data: results, total: results.length, page: query.page };
}
export async function searchProducts(query: SearchQuery): Promise<PaginatedResult<Product>> {
  debug('Searching products: ' + query.term);
  const results = await db.query<Product>('SELECT * FROM products WHERE name LIKE ?', ['%' + query.term + '%']);
  return { ok: true, data: results, total: results.length, page: query.page };
}
export async function globalSearch(term: string) {
  const [users, products] = await Promise.all([
    searchUsers({ term, filters: {}, page: 1, limit: DEFAULT_PAGE_SIZE }),
    searchProducts({ term, filters: {}, page: 1, limit: DEFAULT_PAGE_SIZE })
  ]);
  return { users: users.data || [], products: products.data || [] };
}
