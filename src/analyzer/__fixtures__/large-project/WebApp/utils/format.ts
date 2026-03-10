import { DEFAULT_PAGE_SIZE } from '../../Shared/constants';
export function formatDate(ts: number): string { return new Date(ts).toLocaleDateString(); }
export function formatCurrency(amount: number): string { return '$' + amount.toFixed(2); }
export function truncate(text: string, max: number = 50): string { return text.length > max ? text.slice(0, max) + '...' : text; }
export function pluralize(count: number, singular: string, plural?: string): string { return count === 1 ? singular : (plural || singular + 's'); }
export function pageCount(total: number): number { return Math.ceil(total / DEFAULT_PAGE_SIZE); }
