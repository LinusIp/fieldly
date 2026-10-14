/**
 * `?debug=1` test hook (§13.3), exposed as `window.__fieldlyDebug`. Compiled only into dev and e2e
 * builds: in the Pages build `__DEBUG_HOOK__` is the literal `false`, so `debugEnabled()` is
 * constant-false and the minifier drops the hook code (a unit test checks `dist/`).
 */
export function debugEnabled(): boolean {
  if (!__DEBUG_HOOK__) return false;
  const hashQuery = window.location.hash.split('?')[1] ?? '';
  const params = new URLSearchParams(`${window.location.search.slice(1)}&${hashQuery}`);
  return params.get('debug') === '1';
}

export interface DebugApi {
  /** Fill the active question's widget with a correct answer (the learner still presses Check). */
  answerCurrent?: () => void;
  /** Put the active interactive (explore task, reveal or challenge) into its solution state. */
  loadSolution?: () => void;
  /** Restart the current lesson attempt with this parameter seed. */
  setSeed?: (seed: number) => void;
  /** The screen on show: id and type. */
  current?: () => { id: string; type: string } | null;
}

type Slot = keyof DebugApi;

/** Register one entry; returns a cleanup that removes it only if it is still ours. */
export function registerDebug<K extends Slot>(slot: K, fn: NonNullable<DebugApi[K]>): () => void {
  if (!__DEBUG_HOOK__ || !debugEnabled()) return () => {};
  const w = window as unknown as { __fieldlyDebug?: DebugApi };
  w.__fieldlyDebug ??= {};
  w.__fieldlyDebug[slot] = fn;
  return () => {
    if (w.__fieldlyDebug?.[slot] === fn) delete w.__fieldlyDebug[slot];
  };
}
