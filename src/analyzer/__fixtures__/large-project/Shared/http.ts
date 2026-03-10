import { API_TIMEOUT } from './constants';
import { log, LogLevel } from './logger';
import { Result } from './types';
export async function httpGet<T>(url: string): Promise<Result<T>> { log(LogLevel.DEBUG, 'GET ' + url); return { ok: true }; }
export async function httpPost<T>(url: string, body: unknown): Promise<Result<T>> { log(LogLevel.DEBUG, 'POST ' + url); return { ok: true }; }
export async function httpPut<T>(url: string, body: unknown): Promise<Result<T>> { return { ok: true }; }
export async function httpDelete(url: string): Promise<Result<void>> { return { ok: true }; }
