import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { ConceptsSchema, LessonSchema, type Lesson, type Step } from '../../src/content/schema';
import type { SubjectContent } from '../../src/content/types';
import { evalNumber } from '../../src/engine/expr';
import {
  advanceAttempt,
  challengeScope,
  ensureVariant,
  entryMap,
  finishLesson,
  lessonCtx,
  lessonResult,
  lessonScope,
  maybeInsertExtras,
  openLesson,
  pushFact,
  questionOf,
  recordGraded,
} from '../../src/player/attempt';
import { challengeStars, parMet } from '../../src/player/ChallengeScreen';
import { explanationSteps, answerText } from '../../src/player/QuestionRunner';
import { buildsOnText } from '../../src/player/QuestionScreen';
import { blankMask, fadedCount } from '../../src/player/WorkedScreen';
import { emptyProgress } from '../../src/storage/migrations';
import type { AttemptState, Progress } from '../../src/storage/schema';
import { segmentsOf } from '../../src/widgets/blanks/model';

const ROOT = join(import.meta.dirname, '..', '..');
const read = (p: string) => parse(readFileSync(join(ROOT, p), 'utf8'), { merge: true });
const lesson: Lesson = LessonSchema.parse(read('content/phys2/u3/l2.yaml'));
const subject = {
  id: 'phys2',
  concepts: ConceptsSchema.parse(read('content/phys2/concepts.yaml')),
  misconceptions: [],
  lessons: { [lesson.id]: lesson },
  mixed: {},
  speed: {},
} as SubjectContent;
const ctx = lessonCtx(lesson, subject, 3);
const NOW = new Date('2026-10-14T10:00:00Z');

function started(p: Progress = emptyProgress(), seed = 1): Progress {
  return openLesson(p, ctx, seed, NOW);
}
const att = (p: Progress) => p.lessons[lesson.id]!.attempt!;
const step = (id: string) => entryMap(lesson).get(id) as Step & { type: 'question' };
/** Advance until `id` is the current screen. */
function goTo(p: Progress, id: string): Progress {
  let a = att(p);
  while (a.sequence[a.screenIndex] !== id) a = advanceAttempt(ctx, a, p);
  return { ...p, lessons: { ...p.lessons, [lesson.id]: { ...p.lessons[lesson.id]!, attempt: a } } };
}
function withRating(p: Progress, concept: string, r: number): Progress {
  return {
    ...p,
    ratings: {
      ...p.ratings,
      concept: { ...p.ratings.concept, [`phys2/${concept}`]: { r, n: 20, recent: [] } },
    },
  };
}

describe('attempts (§8.1)', () => {
  it('opens a seeded attempt and resumes it unchanged', () => {
    const p = started(emptyProgress(), 99);
    const a = att(p);
    expect(a.seed).toBe(99);
    expect(a.sequence).toEqual(lesson.screens.map((s) => s.id));
    expect(p.lessons[lesson.id]!.status).toBe('in-progress');
    const again = openLesson(p, ctx, 12345, NOW);
    expect(att(again)).toBe(a);
    expect(lessonScope(lesson, a.seed)).toEqual(lessonScope(lesson, att(again).seed));
  });

  it('starts a new attempt when the lesson version changes', () => {
    const p = started();
    const old = {
      ...p,
      lessons: {
        ...p.lessons,
        [lesson.id]: { ...p.lessons[lesson.id]!, attempt: { ...att(p), lessonVersion: 0 } },
      },
    };
    expect(att(openLesson(old, ctx, 7, NOW)).seed).toBe(7);
  });

  it('draws challenge params from the same seed, separately from the lesson', () => {
    const ch = lesson.screens.find((s) => s.type === 'challenge')!;
    if (ch.type !== 'challenge') throw new Error();
    expect(challengeScope(lesson, ch, 5)).toEqual(challengeScope(lesson, ch, 5));
  });

  it('remembers the rating at the start for the recap', () => {
    const p = started(withRating(emptyProgress(), 'ohms-law', 1111));
    expect(p.ratings.concept['phys2/ohms-law']!.ratingAtLessonStart).toEqual({ [lesson.id]: 1111 });
  });
});

describe('variant selection reacts to performance (§3.2)', () => {
  it('serves standard on the first core step of the first lesson in a subject', () => {
    const p = goTo(started(withRating(emptyProgress(), 'ohms-law', 1500)), 's1');
    expect(att(p).firstInSubject).toBe(true);
    expect(att(p).chosenVariants.s1).toBe('standard');
  });

  it('serves harder to a strong learner and easier to a struggling one', () => {
    const later = (r: number) => {
      let p = withRating(emptyProgress(), 'ohms-law', r);
      p = {
        ...p,
        lessons: { 'phys2.u3.l1': { status: 'completed', bestScore: 1, stars: 3, practised: false } },
      };
      return att(goTo(started(p), 's1')).chosenVariants.s1;
    };
    expect(later(1000)).toBe('standard');
    expect(later(1600)).toBe('harder');
    expect(later(500)).toBe('easier');
  });

  it('turns towards easier after two misses unless the learner is strong', () => {
    let p = { ...started(withRating(emptyProgress(), 'series-resistance', 1000)) };
    p = {
      ...p,
      lessons: {
        ...p.lessons,
        [lesson.id]: { ...p.lessons[lesson.id]!, attempt: { ...att(p), firstInSubject: false } },
      },
    };
    const miss = (a: AttemptState, id: string): AttemptState => ({
      ...a,
      answers: { ...a.answers, [id]: { answer: 0, hintsUsed: 0, attempts: 2, score: 0, correct: false } },
    });
    p = goTo(p, 's2');
    const a = miss(miss(att(p), 's1'), 's2');
    const chosen = ensureVariant(ctx, { ...a, screenIndex: a.sequence.indexOf('s3') }, p, 's3').chosenVariants
      .s3;
    expect(chosen).toBe('easier');
  });
});

describe('recording answers (§3.1, §3.3, §3.4)', () => {
  it('updates concept and subject ratings, memory, mastery, items and misconceptions', () => {
    const p0 = started();
    const s1 = step('s1');
    const q = questionOf(s1, att(p0));
    const rec = { answer: '0', hintsUsed: 0, attempts: 2, score: 0, correct: false };
    const p = recordGraded(
      p0,
      ctx,
      {
        stepId: 's1',
        question: q,
        concept: s1.concept,
        score: 0,
        record: rec,
        misconception: 'multiply-v-r',
        context: 'lesson',
      },
      NOW,
    );
    const key = `phys2/${s1.concept}`;
    expect(p.ratings.concept[key]!.r).toBeLessThan(1000);
    expect(p.ratings.concept[key]!.n).toBe(1);
    expect(p.ratings.concept[key]!.recent).toEqual([{ itemId: `${lesson.id}#${q.id}`, score: 0 }]);
    expect(p.ratings.subject.phys2).toBeLessThan(1000);
    expect(p.memory[key]!.h).toBe(1);
    expect(p.mastery[key]).toBeUndefined();
    expect(p.misconceptions['phys2/multiply-v-r']!.count).toBe(1);
    expect(p.items[`${lesson.id}#${q.id}`]!.attempts).toBe(1);
  });

  it('reaches Practised after three answers and sets freshNext after a tier-3 hint', () => {
    let p = started();
    const s1 = step('s1');
    const q = questionOf(s1, att(p));
    for (let i = 0; i < 3; i++)
      p = recordGraded(
        p,
        ctx,
        {
          stepId: 's1',
          question: q,
          concept: s1.concept,
          score: 0.3,
          record: { answer: '1', hintsUsed: 3, attempts: 1, score: 0.3, correct: true },
          context: 'lesson',
        },
        NOW,
      );
    expect(p.mastery[`phys2/${s1.concept}`]!.level).toBe('practised');
    expect(p.memory[`phys2/${s1.concept}`]!.freshNext).toBe(true);
  });

  it('marks the weakest prerequisite due after a failure', () => {
    let p = started();
    p = { ...p, memory: { 'phys2/ohms-law': { h: 10, last: NOW.toISOString() } } };
    const s3 = step('s3');
    p = recordGraded(
      p,
      ctx,
      {
        stepId: 's3',
        question: questionOf(s3, att(p)),
        concept: s3.concept,
        score: 0,
        record: { answer: '9', hintsUsed: 0, attempts: 2, score: 0, correct: false },
        context: 'lesson',
      },
      NOW,
    );
    expect(p.memory['phys2/ohms-law']!.dueOverride).toBe(true);
  });

  it('pushes each fact once, rendered with the attempt numbers', () => {
    const p = started(emptyProgress(), 3);
    const scope = lessonScope(lesson, 3);
    const s1 = step('s1');
    const a = pushFact(pushFact(att(p), s1.establishes, scope), s1.establishes, scope);
    expect(a.facts).toHaveLength(1);
    expect(a.facts[0]).not.toContain('{{');
  });
});

describe('remediation and bonus steps (§3.2)', () => {
  const scored = (a: AttemptState, ids: string[], score: number): AttemptState => ({
    ...a,
    answers: {
      ...a.answers,
      ...Object.fromEntries(
        ids.map((id) => [id, { answer: 0, hintsUsed: 0, attempts: 1, score, correct: score > 0 }]),
      ),
    },
  });

  it('inserts the remediation for the missed step after two misses in a row', () => {
    let a = att(goTo(started(), 's3'));
    a = maybeInsertExtras(ctx, scored(a, ['s2', 's3'], 0), 's3');
    expect(a.sequence[a.screenIndex + 1]).toBe('r1');
    expect(a.insertedSteps).toEqual(['r1']);
    // Not twice.
    expect(maybeInsertExtras(ctx, a, 's3').sequence.filter((x) => x === 'r1')).toHaveLength(1);
  });

  it('does nothing after one miss, or when the missed step has no remediation', () => {
    const a = att(goTo(started(), 's2'));
    expect(maybeInsertExtras(ctx, scored(a, ['s2'], 0), 's2').sequence).toEqual(a.sequence);
    expect(maybeInsertExtras(ctx, scored(a, ['s1', 's2'], 0), 's2').sequence).toEqual(a.sequence);
  });
});

describe('completion and stars (§3.4)', () => {
  const core = lesson.screens.filter((s) => s.type === 'question' && s.role === 'core').map((s) => s.id);
  const chs = lesson.screens.filter((s) => s.type === 'challenge').map((s) => s.id);
  const play = (score: number, challenge: Partial<AttemptState['challenges'][string]>): AttemptState => {
    const a = att(started());
    return {
      ...a,
      answers: Object.fromEntries(
        core.map((id) => [id, { answer: 0, hintsUsed: 0, attempts: 1, score, correct: true }]),
      ),
      challenges: Object.fromEntries(
        chs.map((id) => [
          id,
          { variant: 'standard', state: null, hintsUsed: 0, checks: 1, solved: true, ...challenge },
        ]),
      ),
    };
  };

  it('needs every core step and both challenges', () => {
    const a = play(1, {});
    expect(lessonResult(lesson, a)).toMatchObject({ completed: true, stars: 3 });
    const { [core[0]]: _, ...fewer } = a.answers;
    void _;
    expect(lessonResult(lesson, { ...a, answers: fewer }).completed).toBe(false);
    expect(lessonResult(lesson, { ...a, challenges: {} }).completed).toBe(false);
  });

  it('gives ★★ without both challenges solved unaided, and ★ under 0.7', () => {
    expect(lessonResult(lesson, play(1, { hintsUsed: 3 })).stars).toBe(2);
    expect(lessonResult(lesson, play(1, { solved: false, usedSolution: true })).stars).toBe(2);
    expect(lessonResult(lesson, play(0.6, {})).stars).toBe(1);
  });

  it('keeps the best result when the lesson is finished again', () => {
    let p = started();
    p = finishLesson(p, lesson, play(1, {}), NOW);
    expect(p.lessons[lesson.id]).toMatchObject({ status: 'completed', stars: 3, bestScore: 1 });
    p = finishLesson(p, lesson, play(0.3, {}), NOW);
    expect(p.lessons[lesson.id]).toMatchObject({ status: 'completed', stars: 3, bestScore: 1 });
  });
});

describe('player helpers', () => {
  it('stars a challenge against par (§9.5)', () => {
    const base = { variant: 'standard', state: null, checks: 1, solved: true };
    expect(challengeStars({ ...base, hintsUsed: 0 }, true)).toBe(3);
    expect(challengeStars({ ...base, hintsUsed: 0 }, false)).toBe(2);
    expect(challengeStars({ ...base, hintsUsed: 1 }, true)).toBe(1);
    expect(challengeStars({ ...base, hintsUsed: 0, usedSolution: true }, true)).toBe(0);
    expect(parMet({ parts: 2 }, { parts: 2 })).toBe(true);
    expect(parMet({ parts: 2 }, { parts: 3 })).toBe(false);
    expect(parMet(undefined, {})).toBe(true);
  });

  it('builds the tier-2 hint from uses and facts (§2.4)', () => {
    expect(
      buildsOnText(
        undefined,
        (x) => x,
        () => undefined,
      ),
    ).toBeNull();
    expect(
      buildsOnText(
        ['s1', 's3'],
        (x) => x.toUpperCase(),
        (x) => (x === 's1' ? 'I = 2 A' : undefined),
      ),
    ).toBe('This builds on S1: I = 2 A; S3.');
  });

  it('stages long explanations and strips describe() verbs', () => {
    expect(explanationSteps('a\n\nb\n\nc')).toEqual(['a\n\nb\n\nc']);
    expect(explanationSteps('a\n\nb\n\nc\n\nd')).toEqual(['a\n\nb', 'c', 'd']);
    expect(answerText('Chose "It gets dimmer"')).toBe('"It gets dimmer"');
    expect(answerText('Answered 2 A')).toBe('2 A');
  });

  it('fades worked-example spans from the last step, one per 100 rating points above 1000 (§8.1)', () => {
    expect(fadedCount('adaptive', 1000)).toBe(0);
    expect(fadedCount('adaptive', 1250)).toBe(2);
    expect(fadedCount('none', 1500)).toBe(0);
    const steps = ['a [[?1]] b [[2]]', 'c [[?3]]', 'd [[?4]]'].map(segmentsOf);
    expect(blankMask(steps, 0)).toEqual([[false, true], [false], [false]]);
    expect(blankMask(steps, 2)).toEqual([[false, true], [true], [true]]);
    expect(blankMask(steps, 9)).toEqual([[true, true], [true], [true]]);
  });

  it('every reference-lesson numeric answer is finite for its seed', () => {
    for (const seed of [1, 2, 3]) {
      const scope = lessonScope(lesson, seed);
      const q = questionOf(step('s1'), att(started(emptyProgress(), seed)));
      expect(
        Number.isFinite(evalNumber((q as unknown as { answer: { expr: string } }).answer.expr, scope)),
      ).toBe(true);
    }
  });
});
