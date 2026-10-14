import { DEFAULTS } from '../config';
import { ProgressV1Schema, type Progress } from './schema';

export const CURRENT_VERSION = 1;

export function emptyProgress(now = new Date()): Progress {
  return {
    version: 1,
    createdAt: now.toISOString(),
    ratings: { subject: {}, concept: {} },
    lessons: {},
    questions: {},
    misconceptions: {},
    review: {},
    settings: {
      theme: DEFAULTS.theme,
      fontScale: DEFAULTS.fontScale,
      reducedMotion: DEFAULTS.reducedMotion,
      codeLang: DEFAULTS.codeLang,
    },
    activity: {},
  };
}

type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

/**
 * migrations[n] upgrades version n to n + 1. Add an entry whenever the stored shape changes
 * and bump CURRENT_VERSION.
 */
export const migrations: Record<number, Migration> = {
  // 0 → 1: pre-release data had no version field; fill in anything missing.
  0: (d) => ({ ...emptyProgress(), ...d, version: 1 }),
};

/** Bring any stored value up to the current version, or throw if it cannot be read. */
export function migrate(raw: unknown): Progress {
  if (typeof raw !== 'object' || raw === null) throw new Error('progress is not an object');
  let data = raw as Record<string, unknown>;
  let v = typeof data.version === 'number' ? data.version : 0;
  if (v > CURRENT_VERSION)
    throw new Error(`progress version ${v} is newer than this app (${CURRENT_VERSION})`);
  while (v < CURRENT_VERSION) {
    const m = migrations[v];
    if (!m) throw new Error(`no migration from version ${v}`);
    data = m(data);
    v = typeof data.version === 'number' ? data.version : v + 1;
  }
  const parsed = ProgressV1Schema.safeParse(data);
  if (!parsed.success) {
    throw new Error(
      'progress failed validation: ' +
        parsed.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; '),
    );
  }
  return parsed.data;
}
