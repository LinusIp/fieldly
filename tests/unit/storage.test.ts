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
  p.ratings.concept['ohms-law'] = { r: 1120, n: 6 };
  p.lessons['phys2.u3.l2'] = {
    status: 'completed',
    bestScore: 0.92,
    stars: 3,
    completedAt: '2026-01-02T00:00:00Z',
  };
  p.lessons['phys2.u3.l3'] = {
    status: 'in-progress',
    bestScore: 0,
    stars: 0,
    attempt: {
      seed: 42,
      stage: 'practice',
      stepIndex: 2,
      chosenVariants: { s1: 'standard', s2: 'easier' },
      insertedSteps: [],
      answers: { s1: { selected: [0], hintsUsed: 0, score: 1 } },
      facts: ['fact'],
      sequence: ['s1', 's2', 's3', 's4', 's5', 's6'],
      factSteps: ['s1'],
      firstInSubject: false,
      ratingsBefore: { 'ohms-law': 1100 },
      lessonVersion: 1,
      skippedSteps: [],
      startedAt: '2026-01-03T00:00:00Z',
    },
  };
  p.questions['phys2.u3.l2#s1-s'] = { lastScore: 1, attempts: 2, version: 1 };
  p.misconceptions['ohm-multiply'] = { count: 2, lastSeen: '2026-01-02T00:00:00Z' };
  p.review['phys2.u3.l2#s3-s'] = { box: 2, due: '2026-01-05T00:00:00Z' };
  p.settings.theme = 'dark';
  p.activity = { '2026-01-02': 5 };
  return p;
}

describe('migrations', () => {
  it('upgrades unversioned data and fills defaults', () => {
    const p = migrate({ ratings: { subject: { phys2: 1100 }, concept: {} } });
    expect(p.version).toBe(1);
    expect(p.ratings.subject.phys2).toBe(1100);
    expect(p.settings.theme).toBe('system');
  });
  it('rejects data from a newer app version', () => {
    expect(() => migrate({ ...emptyProgress(), version: 99 })).toThrow(/newer/);
  });
  it('rejects malformed data', () => {
    expect(() => migrate({ version: 1, ratings: 'nope' })).toThrow();
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
      reviewItems: 1,
    });
  });
  it('reports bad files', () => {
    expect(parseImport('not json').ok).toBe(false);
    expect(parseImport('{"version": 1, "lessons": 5}').ok).toBe(false);
  });
  it('names the file by date', () => {
    expect(exportFileName(new Date(2026, 9, 4))).toBe('fieldly-progress-2026-10-04.json');
  });
});

describe('streak', () => {
  it('counts consecutive days ending today or yesterday', () => {
    const now = new Date(2026, 0, 10, 12);
    expect(streak({ '2026-01-10': 1, '2026-01-09': 3, '2026-01-08': 1, '2026-01-06': 1 }, now)).toBe(3);
    expect(streak({ '2026-01-09': 1, '2026-01-08': 1 }, now)).toBe(2);
    expect(streak({ '2026-01-07': 1 }, now)).toBe(0);
  });
});
