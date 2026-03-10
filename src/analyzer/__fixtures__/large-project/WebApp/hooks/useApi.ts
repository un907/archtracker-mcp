import { httpGet, httpPost, httpPut, httpDelete } from '../../Shared/http';
import { Result } from '../../Shared/types';
import { error } from '../../Shared/logger';
export function useApi() {
  async function get<T>(path: string): Promise<Result<T>> {
    try { return await httpGet<T>('/api' + path); }
    catch (e) { error('API GET failed: ' + path); return { ok: false, error: 'Request failed' }; }
  }
  async function post<T>(path: string, body: unknown): Promise<Result<T>> {
    try { return await httpPost<T>('/api' + path, body); }
    catch (e) { error('API POST failed: ' + path); return { ok: false, error: 'Request failed' }; }
  }
  async function put<T>(path: string, body: unknown): Promise<Result<T>> { return httpPut<T>('/api' + path, body); }
  async function del(path: string): Promise<Result<void>> { return httpDelete('/api' + path); }
  return { get, post, put, del };
}
