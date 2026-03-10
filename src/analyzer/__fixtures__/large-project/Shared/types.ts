export type ID = string;
export type Timestamp = number;
export interface Result<T> { ok: boolean; data?: T; error?: string; }
export interface PaginatedResult<T> extends Result<T[]> { total: number; page: number; }
