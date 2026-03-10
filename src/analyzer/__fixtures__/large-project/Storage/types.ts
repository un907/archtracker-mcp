import { ID, Timestamp } from '../Shared/types';
export interface Entity { id: ID; createdAt: Timestamp; updatedAt: Timestamp; }
export interface QueryOptions { limit?: number; offset?: number; orderBy?: string; }
export interface Repository<T extends Entity> { findById(id: ID): Promise<T | null>; findAll(opts?: QueryOptions): Promise<T[]>; create(data: Partial<T>): Promise<T>; update(id: ID, data: Partial<T>): Promise<T>; delete(id: ID): Promise<void>; }
