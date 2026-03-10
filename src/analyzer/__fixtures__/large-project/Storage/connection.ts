import { loadConfig } from '../Shared/config';
import { info, error } from '../Shared/logger';
export class DatabaseConnection {
  private connected = false;
  async connect() { const cfg = loadConfig(); info('Connecting to DB: ' + cfg.dbUrl); this.connected = true; }
  async disconnect() { info('Disconnecting from DB'); this.connected = false; }
  async query<T>(sql: string, params?: unknown[]): Promise<T[]> { return []; }
  async transaction<T>(fn: () => Promise<T>): Promise<T> { return fn(); }
}
export const db = new DatabaseConnection();
