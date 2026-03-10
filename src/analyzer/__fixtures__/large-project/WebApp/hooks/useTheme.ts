import { debug } from '../../Shared/logger';
export type Theme = 'light' | 'dark' | 'system';
export function useTheme() {
  let current: Theme = 'system';
  function setTheme(theme: Theme) { current = theme; debug('Theme changed: ' + theme); }
  function getTheme() { return current; }
  function toggleTheme() { setTheme(current === 'light' ? 'dark' : 'light'); }
  return { current, setTheme, getTheme, toggleTheme };
}
