/**
 * `?debug=1` test hook (§13.3). Compiled only into dev and e2e builds: in the Pages build
 * __DEBUG_HOOK__ is the literal `false`, so this always returns false and the hook code
 * is dropped by the minifier.
 */
export function debugEnabled(): boolean {
  if (!__DEBUG_HOOK__) return false;
  const hashQuery = window.location.hash.split('?')[1] ?? '';
  const params = new URLSearchParams(`${window.location.search.slice(1)}&${hashQuery}`);
  return params.get('debug') === '1';
}

export interface DebugApi {
  /** Display index (0-based) of the correct option of the current question. */
  correctIndex?: number;
  /** Load the current challenge's solution into the builder. */
  loadSolution?: () => void;
}

export function setDebugApi(patch: Partial<DebugApi>): void {
  if (!__DEBUG_HOOK__ || !debugEnabled()) return;
  const w = window as unknown as { __fieldlyDebug?: DebugApi };
  w.__fieldlyDebug = { ...(w.__fieldlyDebug ?? {}), ...patch };
}
