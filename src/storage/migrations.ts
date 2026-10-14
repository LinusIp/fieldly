import { DEFAULTS } from '../config';
import { ProgressSchema, type Progress } from './schema';

export const CURRENT_VERSION = 2;

export function emptyProgress(now = new Date()): Progress {
  return {
    version: 2,
    createdAt: now.toISOString(),
    ratings: { subject: {}, concept: {} },
    memory: {},
    mastery: {},
    lessons: {},
    units: {},
    items: {},
    mistakes: {},
    misconceptions: {},
    puzzles: {},
    sandbox: {},
    speed: {},
    xp: { total: 0, byDay: {} },
    streak: { current: 0, longest: 0, lastDay: '', charges: 0 },
    settings: {
      theme: DEFAULTS.theme,
      fontScale: DEFAULTS.fontScale,
      reducedMotion: DEFAULTS.reducedMotion,
      dailyGoal: DEFAULTS.dailyGoal,
      confidencePrompts: DEFAULTS.confidencePrompts,
      codeLang: DEFAULTS.codeLang,
    },
  };
}

type Data = Record<string, unknown>;
type Migration = (data: Data) => Data;

/**
 * migrations[n] upgrades version n to n + 1. Add an entry whenever the stored shape changes
 * and bump CURRENT_VERSION.
 */
export const migrations: Record<number, Migration> = {
  // 0 → 1: pre-release data had no version field.
  0: (d) => ({ ...d, version: 1 }),
  // 1 → 2: spec v2. Lesson statuses, stars, subject ratings, misconception counts and settings carry
  // over; v1 attempts, concept ratings (un-namespaced keys) and the Leitner review queue don't.
  1: (d) => {
    const base = emptyProgress(new Date(typeof d.createdAt === 'string' ? d.createdAt : Date.now()));
    const lessons: Progress['lessons'] = {};
    for (const [id, l] of Object.entries((d.lessons ?? {}) as Record<string, Data>)) {
      const status = l.status === 'completed' ? 'completed' : 'not-started';
      lessons[id] = {
        status,
        bestScore: typeof l.bestScore === 'number' ? l.bestScore : 0,
        stars:
          status === 'completed' && [0, 1, 2, 3].includes(l.stars as number) ? (l.stars as 0 | 1 | 2 | 3) : 0,
        practised: false,
        completedAt: typeof l.completedAt === 'string' ? l.completedAt : undefined,
        lastOpenedAt: typeof l.lastOpenedAt === 'string' ? l.lastOpenedAt : undefined,
      };
    }
    const ratings = (d.ratings ?? {}) as { subject?: Record<string, number> };
    const settings = (d.settings ?? {}) as Partial<Progress['settings']>;
    return {
      ...base,
      lessons,
      ratings: { subject: ratings.subject ?? {}, concept: {} },
      misconceptions: (d.misconceptions as Progress['misconceptions']) ?? {},
      settings: { ...base.settings, ...settings },
    };
  },
};

/** Bring any stored value up to the current version, or throw if it cannot be read. */
export function migrate(raw: unknown): Progress {
  if (typeof raw !== 'object' || raw === null) throw new Error('progress is not an object');
  let data = raw as Data;
  let v = typeof data.version === 'number' ? data.version : 0;
  if (v > CURRENT_VERSION)
    throw new Error(`progress version ${v} is newer than this app (${CURRENT_VERSION})`);
  while (v < CURRENT_VERSION) {
    const m = migrations[v];
    if (!m) throw new Error(`no migration from version ${v}`);
    data = m(data);
    v = typeof data.version === 'number' ? data.version : v + 1;
  }
  const parsed = ProgressSchema.safeParse(data);
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
