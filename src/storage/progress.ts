import { create } from 'zustand';
import { APP_KEY } from '../config';
import { emptyProgress, migrate } from './migrations';
import type { Progress, Settings } from './schema';

export const STORAGE_KEY = `${APP_KEY}progress`;
const SAVE_DEBOUNCE_MS = 300;

function readStorage(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyProgress();
    return migrate(JSON.parse(raw));
  } catch (e) {
    console.warn('Could not read stored progress; starting fresh.', e);
    // Keep the unreadable copy so it isn't silently lost.
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) localStorage.setItem(`${STORAGE_KEY}.corrupt`, raw);
    } catch {
      /* ignore */
    }
    return emptyProgress();
  }
}

function writeStorage(p: Progress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch (e) {
    console.warn('Could not save progress.', e);
  }
}

interface ProgressStore {
  progress: Progress;
  /** Apply an immutable update; saving is debounced. */
  update(fn: (p: Progress) => Progress): void;
  replace(p: Progress): void;
  reset(): void;
  setSettings(patch: Partial<Settings>): void;
  flush(): void;
}

let timer: ReturnType<typeof setTimeout> | undefined;
let dirty = false;

export const useProgress = create<ProgressStore>((set, get) => {
  const schedule = () => {
    dirty = true;
    clearTimeout(timer);
    timer = setTimeout(() => get().flush(), SAVE_DEBOUNCE_MS);
  };
  return {
    progress: typeof localStorage === 'undefined' ? emptyProgress() : readStorage(),
    update(fn) {
      set({ progress: fn(get().progress) });
      schedule();
    },
    replace(p) {
      set({ progress: p });
      dirty = true;
      get().flush();
    },
    reset() {
      get().replace(emptyProgress());
    },
    setSettings(patch) {
      get().update((p) => ({ ...p, settings: { ...p.settings, ...patch } }));
    },
    flush() {
      clearTimeout(timer);
      if (!dirty) return;
      dirty = false;
      writeStorage(get().progress);
    },
  };
});

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') useProgress.getState().flush();
  });
  window.addEventListener('pagehide', () => useProgress.getState().flush());
  // Another tab changed progress: pick it up.
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        useProgress.setState({ progress: migrate(JSON.parse(e.newValue)) });
      } catch {
        /* ignore */
      }
    }
  });
}

export function localDay(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Consecutive days with activity, ending today (or yesterday if nothing yet today). */
export function streak(activity: Record<string, number>, now = new Date()): number {
  let n = 0;
  const d = new Date(now);
  if (!activity[localDay(d)]) d.setDate(d.getDate() - 1);
  while (activity[localDay(d)]) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
