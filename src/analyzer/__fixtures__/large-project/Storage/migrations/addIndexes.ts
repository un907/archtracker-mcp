import { db } from '../connection';
import { info } from '../../Shared/logger';
import { runInitMigration } from './init';
export async function runAddIndexes() {
  await runInitMigration();
  info('Adding indexes');
  await db.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_orders_userId ON orders(userId)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_notifications_userId ON notifications(userId)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)');
}
