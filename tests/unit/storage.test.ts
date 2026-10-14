import { describe, expect, it } from 'vitest';
import {
  exportFileName,
  parseImport,
  serializeProgress,
  summarizeProgress,
} from '../../src/storage/exportImport';
import { emptyProgress, migrate } from '../../src/storage/migrations';
import { streak } from '../../src/storage/progress';
import type { Progress } from '../../src/storage/schema';

function sample(): Progress {
  const p = emptyProgress(new Date('2026-01-01T00:00:00Z'));
  p.ratings.subject.phys2 = 1080;
  p.ratings.concept['phys2/ohms-law'] = { r: 1120, n: 6, recent: [{ itemId: 'phys2.u3.l2#s1-s', score: 1 }] };
  p.memory['phys2/ohms-law'] = { h: 2.5, last: '2026-01-02T00:00:00Z' };
  p.mastery['phys2/ohms-law'] = { level: 'practised' };
  p.lessons['phys2.u3.l2'] = {
    status: 'completed',
    bestScore: 0.92,
    stars: 3,
    practised: false,
    completedAt: '2026-01-02T00:00:00Z',
  };
  p.lessons['phys2.u3.l3'] = {
    status: 'in-progress',
    bestScore: 0,
    stars: 0,
    practised: false,
    attempt: {
      lessonVersion: 1,
      seed: 42,
      screenIndex: 3,
      chosenVariants: { s1: 'standard' },
      insertedSteps: [],
      answers: { s1: { answer: 2, hintsUsed: 0, attempts: 1, score: 1, correct: true, variant: 'standard' } },
      explore: { e1: { taskIndex: 1, state: { values: { R1: 3 } } } },
      challenges: {},
      facts: ['fact'],
      sequence: ['h1', 'e1', 'c1', 's1'],
      skipped: [],
      firstInSubject: false,
      startedAt: '2026-01-03T00:00:00Z',
    },
  };
  p.items['phys2.u3.l2#s1-s'] = { lastScore: 1, attempts: 2, lastAt: '2026-01-02T00:00:00Z', version: 1 };
  p.misconceptions['phys2/ohm-multiply'] = { count: 2, lastSeen: '2026-01-02T00:00:00Z' };
  p.xp = { total: 150, byDay: { '2026-01-02': 150 } };
  p.settings.theme = 'dark';
  return p;
}

describe('migrations', () => {
  it('upgrades unversioned data to the current shape', () => {
    const p = migrate({ ratings: { subject: { phys2: 1100 }, concept: {} } });
    expect(p.version).toBe(2);
    expect(p.ratings.subject.phys2).toBe(1100);
    expect(p.settings.dailyGoal).toBe(100);
  });
  it('carries v1 lesson results and settings into v2, dropping v1 attempts', () => {
    const v1 = {
      version: 1,
      createdAt: '2026-01-01T00:00:00Z',
      ratings: { subject: { phys2: 1050 }, concept: { 'ohms-law': { r: 1100, n: 4 } } },
      lessons: {
        'phys2.u3.l2': { status: 'completed', bestScore: 0.9, stars: 3 },
        'phys2.u3.l3': { status: 'in-progress', bestScore: 0, stars: 0, attempt: { seed: 1 } },
      },
      questions: {},
      misconceptions: { 'ohm-multiply': { count: 1, lastSeen: '2026-01-02T00:00:00Z' } },
      review: {},
      settings: { theme: 'dark', fontScale: 1.1, reducedMotion: true, codeLang: 'javascript' },
      activity: {},
    };
    const p = migrate(v1);
    expect(p.version).toBe(2);
    expect(p.lessons['phys2.u3.l2']).toMatchObject({ status: 'completed', stars: 3 });
    expect(p.lessons['phys2.u3.l3']).toMatchObject({ status: 'not-started' });
    expect(p.lessons['phys2.u3.l3'].attempt).toBeUndefined();
    expect(p.settings).toMatchObject({
      theme: 'dark',
      fontScale: 1.1,
      codeLang: 'javascript',
      dailyGoal: 100,
    });
    expect(p.ratings.concept).toEqual({});
  });
  it('rejects data from a newer app version', () => {
    expect(() => migrate({ ...emptyProgress(), version: 99 })).toThrow(/newer/);
  });
  it('rejects malformed data', () => {
    expect(() => migrate({ ...emptyProgress(), ratings: 'nope' })).toThrow();
    expect(() => migrate(null)).toThrow();
  });
});

describe('export / import', () => {
  it('round-trips exactly', () => {
    const p = sample();
    const r = parseImport(serializeProgress(p));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.progress).toEqual(p);
  });
  it('summarises an import', () => {
    expect(summarizeProgress(sample())).toEqual({
      createdAt: '2026-01-01T00:00:00.000Z',
      lessonsStarted: 2,
      lessonsCompleted: 1,
      stars: 3,
      questionsAnswered: 2,
      xp: 150,
    });
  });
  it('reports bad files', () => {
    expect(parseImport('not json').ok).toBe(false);
    expect(parseImport('{"version": 2, "lessons": 5}').ok).toBe(false);
  });
  it('names the file by date', () => {
    expect(exportFileName(new Date(2026, 9, 4))).toBe('fieldly-progress-2026-10-04.json');
  });
});

describe('streak (legacy helper)', () => {
  it('counts consecutive days ending today or yesterday', () => {
    const now = new Date(2026, 0, 10, 12);
    expect(streak({ '2026-01-10': 1, '2026-01-09': 3, '2026-01-08': 1, '2026-01-06': 1 }, now)).toBe(3);
    expect(streak({ '2026-01-09': 1, '2026-01-08': 1 }, now)).toBe(2);
    expect(streak({ '2026-01-07': 1 }, now)).toBe(0);
  });
});
