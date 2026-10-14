import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import { describe, expect, it } from 'vitest';
import { LessonSchema, type Lesson } from '../../src/content/schema';
import {
  advance,
  applyAnswer,
  completeLesson,
  currentQuestion,
  ensureVariant,
  lessonScope,
  maybeInsert,
  newAttempt,
  optionsFor,
  resetStaleQuestions,
} from '../../src/player/attempt';
import { emptyProgress } from '../../src/storage/migrations';
import type { AttemptState, Progress } from '../../src/storage/schema';

const lesson: Lesson = LessonSchema.parse(
  YAML.parse(readFileSync(join(import.meta.dirname, '../../content/phys2/u3/l2.yaml'), 'utf8')),
);
const now = new Date('2026-03-01T10:00:00Z');

function answer(
  a: AttemptState,
  p: Progress,
  correct: boolean,
): { attempt: AttemptState; progress: Progress } {
  const stepId = a.sequence[a.stepIndex];
  const q = currentQuestion(lesson, a, stepId)!;
  const scope = lessonScope(lesson, a.seed);
  const opts = optionsFor(q, scope, a.seed);
  const pick = correct ? opts.find((o) => o.correct)! : opts.find((o) => !o.correct)!;
  const second = opts.filter((o) => !o.correct)[1];
  const selected = correct ? [pick.index] : [pick.index, second.index];
  return applyAnswer(
    lesson,
    a,
    p,
    {
      stepId,
      question: q,
      selected,
      hintsUsed: 0,
      score: correct ? 1 : 0,
      misconceptions: correct ? [] : [pick.misconception!, second.misconception!],
    },
    scope,
    now,
  );
}

function start(p: Progress, seed = 7): AttemptState {
  return ensureVariant(lesson, { ...newAttempt(lesson, p, now, seed), stage: 'practice' }, p);
}

describe('lesson attempt', () => {
  it('forces standard for step 1 of the first lesson in a subject, then adapts', () => {
    const p = emptyProgress(now);
    const a = start(p);
    expect(a.firstInSubject).toBe(true);
    expect(a.chosenVariants.s1).toBe('standard');
    // At rating 1000 the easier variant (p ≈ 0.70) is closest to the 0.78 target.
    const r = answer(a, p, true);
    const a2 = advance(lesson, r.attempt, r.progress);
    expect(a2.chosenVariants.s2).toBe('easier');
  });

  it('moves strong students to harder variants', () => {
    const p = emptyProgress(now);
    p.ratings.concept['ohms-law'] = { r: 1400, n: 20 };
    p.lessons['phys2.u3.l1'] = { status: 'completed', bestScore: 1, stars: 3 };
    const a = start(p);
    expect(a.firstInSubject).toBe(false);
    expect(a.chosenVariants.s1).toBe('harder');
  });

  it('is deterministic for a seed (resume keeps numbers and variants)', () => {
    const p = emptyProgress(now);
    const a = start(p, 99);
    const b = start(p, 99);
    expect(lessonScope(lesson, a.seed)).toEqual(lessonScope(lesson, b.seed));
    const q = currentQuestion(lesson, a, 's1')!;
    expect(optionsFor(q, lessonScope(lesson, 99), 99)).toEqual(optionsFor(q, lessonScope(lesson, 99), 99));
    // A stored variant is never re-chosen.
    const stored = { ...a, chosenVariants: { s1: 'harder' as const } };
    expect(ensureVariant(lesson, stored, p).chosenVariants.s1).toBe('harder');
  });

  it('records ratings, misconceptions, review items and facts', () => {
    const p = emptyProgress(now);
    const a = start(p);
    const r = answer(a, p, false);
    expect(r.progress.ratings.concept['ohms-law'].r).toBeLessThan(1000);
    expect(r.progress.ratings.concept['ohms-law'].n).toBe(1);
    expect(Object.keys(r.progress.misconceptions).length).toBe(2);
    expect(Object.keys(r.progress.review)).toEqual(['phys2.u3.l2#s1-s']);
    expect(r.attempt.facts.length).toBe(1);
    expect(r.attempt.facts[0]).toMatch(/Single resistor: \d+(\.\d+)? A flows/);
  });

  it('inserts the remediation step after two misses near s3', () => {
    let p = emptyProgress(now);
    let a = start(p);
    // s1 right, s2 wrong, s3 wrong → r1 (remediates s3) is inserted after s3.
    let r = answer(a, p, true);
    a = advance(lesson, r.attempt, r.progress);
    p = r.progress;
    r = answer(a, p, false);
    a = advance(lesson, r.attempt, r.progress);
    p = r.progress;
    expect(a.sequence).toEqual(['s1', 's2', 's3', 's4', 's5', 's6']);
    r = answer(a, p, false);
    expect(r.attempt.sequence).toEqual(['s1', 's2', 's3', 'r1', 's4', 's5', 's6']);
    expect(r.attempt.insertedSteps).toEqual(['r1']);
    a = advance(lesson, r.attempt, r.progress);
    expect(a.sequence[a.stepIndex]).toBe('r1');
    expect(a.chosenVariants.r1).toBe('standard');
  });

  it('inserts remediation before s3 when s1 and s2 are missed', () => {
    const a: AttemptState = {
      ...newAttempt(lesson, emptyProgress(now), now, 1),
      stage: 'practice',
      stepIndex: 1,
      answers: {
        s1: { selected: [1, 2], hintsUsed: 0, score: 0 },
        s2: { selected: [1, 2], hintsUsed: 0, score: 0 },
      },
    };
    expect(maybeInsert(lesson, a).sequence).toEqual(['s1', 's2', 'r1', 's3', 's4', 's5', 's6']);
  });

  it('reaches the challenge after the last step and completes with stars', () => {
    let p = emptyProgress(now);
    let a = start(p);
    for (let i = 0; i < 6; i++) {
      const r = answer(a, p, true);
      p = r.progress;
      a = advance(lesson, r.attempt, p);
    }
    expect(a.stage).toBe('challenge');
    const withCh = {
      ...a,
      challenge: { variant: 'standard', state: null, hintsUsed: 0, checks: 1, solved: true },
    };
    const done = completeLesson(lesson, withCh, p, now);
    expect(done.stars).toBe(3);
    expect(done.progress.lessons['phys2.u3.l2']).toMatchObject({
      status: 'completed',
      stars: 3,
      bestScore: 1,
    });
  });

  it('resets history when a question version increases', () => {
    const p = emptyProgress(now);
    p.questions['phys2.u3.l2#s1-s'] = { lastScore: 0, attempts: 1, version: 0 };
    p.review['phys2.u3.l2#s1-s'] = { box: 1, due: now.toISOString() };
    const q = resetStaleQuestions(lesson, p);
    expect(q.questions['phys2.u3.l2#s1-s']).toBeUndefined();
    expect(q.review['phys2.u3.l2#s1-s']).toBeUndefined();
  });
});
