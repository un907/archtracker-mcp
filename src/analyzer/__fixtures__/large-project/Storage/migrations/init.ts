import { db } from '../connection';
import { info } from '../../Shared/logger';
export async function runInitMigration() {
  info('Running init migration');
  await db.query('CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT, name TEXT, role TEXT, passwordHash TEXT, createdAt INTEGER, updatedAt INTEGER)');
  await db.query('CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT, price REAL, category TEXT, stock INTEGER, createdAt INTEGER, updatedAt INTEGER)');
  await db.query('CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, userId TEXT, items TEXT, total REAL, status TEXT, createdAt INTEGER, updatedAt INTEGER)');
  await db.query('CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, userId TEXT, type TEXT, message TEXT, read INTEGER, createdAt INTEGER, updatedAt INTEGER)');
}
