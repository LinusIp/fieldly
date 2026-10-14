import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { track } from '../../analytics';
import { ErrorState, Loading } from '../../components/ui';
import { findLesson, loadSubject, useContentIndex } from '../../content/loader';
import type { SubjectContent } from '../../content/types';
import { buildOptions } from '../../engine/options';
import { dueItems } from '../../engine/review';
import { stepScore } from '../../engine/scoring';
import { renderTemplate } from '../../engine/template';
import { lessonScope, subjectOf } from '../../player/attempt';
import { HintLadder, nextHintTier, type RenderedHints } from '../../player/HintLadder';
import { QuestionCard, useQuestionKeys } from '../../player/QuestionCard';
import {
  applyReviewAnswer,
  freshSeed,
  parseKey,
  pruneReview,
  resolveReviewItem,
  type ReviewItem,
} from '../../player/review';
import { useProgress } from '../../storage/progress';

interface Outcome {
  key: string;
  score: number;
  boxBefore: number;
  boxAfter: number | null;
}

export default function ReviewPage() {
  const { data: index, error } = useContentIndex();
  const progress = useProgress((s) => s.progress);
  const update = useProgress((s) => s.update);
  // The session's items are fixed when it starts, oldest due first (max 10).
  const [sessionKeys] = useState(() => dueItems(progress.review, new Date()));
  const [subjects, setSubjects] = useState<Map<string, SubjectContent> | null>(null);
  const [pos, setPos] = useState(0);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);

  useEffect(() => {
    const ids = [
      ...new Set(
        Object.keys(progress.review)
          .map((k) => parseKey(k)?.lessonId)
          .filter((x): x is string => !!x)
          .map(subjectOf),
      ),
    ];
    let alive = true;
    Promise.all(ids.map((id) => loadSubject(id).then((s) => [id, s] as const))).then(
      (pairs) => {
        if (!alive) return;
        const m = new Map(pairs);
        setSubjects(m);
        update((p) => pruneReview(p, m));
      },
      () => alive && setSubjects(new Map()),
    );
    return () => {
      alive = false;
    };
    // Load once per visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = useMemo(
    () =>
      subjects
        ? sessionKeys.map((k) => resolveReviewItem(k, subjects)).filter((x): x is ReviewItem => x !== null)
        : [],
    [subjects, sessionKeys],
  );

  if (error) return <ErrorState error={error} />;
  if (!index || !subjects) return <Loading what="Loading your review queue" />;

  const nextDue = Object.values(progress.review)
    .map((r) => r.due)
    .sort()[0];

  if (items.length === 0 || pos >= items.length) {
    const up = outcomes.filter((o) => o.boxAfter === null || o.boxAfter > o.boxBefore).length;
    return (
      <div className="mx-auto max-w-3xl px-4 py-10" data-testid="review-done">
        <h1 className="text-2xl font-semibold">Review</h1>
        {outcomes.length > 0 ? (
          <>
            <p className="mt-2 text-muted">
              You reviewed {outcomes.length} question{outcomes.length === 1 ? '' : 's'}: {up} moved up,{' '}
              {outcomes.length - up} will come back tomorrow.
            </p>
            <ul className="mt-4 space-y-1 text-sm">
              {outcomes.map((o) => {
                const loc = findLesson(index, parseKey(o.key)!.lessonId);
                return (
                  <li key={o.key} className="flex justify-between gap-4 rounded-lg bg-surface px-3 py-2">
                    <span>{loc?.lesson.title ?? o.key}</span>
                    <span className={o.score >= 0.8 ? 'text-ok' : 'text-bad'}>
                      {o.score >= 0.8 ? '✓' : '✕'} score {o.score} ·{' '}
                      {o.boxAfter === null ? 'retired' : `box ${o.boxBefore} → ${o.boxAfter}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="mt-2 text-muted">
            Nothing is due right now.{' '}
            {nextDue
              ? `The next question comes back on ${new Date(nextDue).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}.`
              : 'Questions you miss in lessons will appear here, with new numbers.'}
          </p>
        )}
        <p className="mt-4 text-sm text-muted">
          How it works: a question you score below 0.6 on enters box 1. Each box waits longer before it comes
          back — 1, 3, 7, 14, then 30 days. Answer well (≥ 0.8) and it moves up a box; miss it and it goes
          back to box 1.
        </p>
        <Link to="/" className="mt-6 inline-block text-accent underline">
          Back to subjects
        </Link>
      </div>
    );
  }

  const item = items[pos];
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Review</h1>
        <span className="text-sm text-muted" data-testid="review-progress">
          {pos + 1} of {items.length}
        </span>
      </div>
      <ReviewQuestion
        key={`${item.key}-${pos}`}
        item={item}
        lastSeed={progress.review[item.key]?.seed}
        lessonTitle={findLesson(index, item.lesson.id)?.lesson.title ?? item.lesson.title}
        misconceptionShort={(id) => {
          const m = subjects.get(subjectOf(item.lesson.id))?.misconceptions.find((x) => x.id === id);
          return m?.short ?? '';
        }}
        onDone={(r) => {
          const before = progress.review[item.key]?.box ?? 1;
          update((p) => applyReviewAnswer(p, item, r, new Date()));
          const after = useProgress.getState().progress.review[item.key]?.box ?? null;
          setOutcomes((o) => [...o, { key: item.key, score: r.score, boxBefore: before, boxAfter: after }]);
          track({
            type: 'question-answered',
            lessonId: item.lesson.id,
            questionId: item.question.id,
            score: r.score,
            attempts: r.selected.length,
            hintsUsed: r.hintsUsed,
            review: true,
          });
        }}
        onNext={() => setPos((x) => x + 1)}
        isLast={pos === items.length - 1}
      />
    </div>
  );
}

function ReviewQuestion({
  item,
  lastSeed,
  lessonTitle,
  misconceptionShort,
  onDone,
  onNext,
  isLast,
}: {
  item: ReviewItem;
  lastSeed: number | undefined;
  lessonTitle: string;
  misconceptionShort(id: string): string;
  onDone(r: {
    seed: number;
    selected: number[];
    hintsUsed: number;
    score: number;
    misconceptions: string[];
  }): void;
  onNext(): void;
  isLast: boolean;
}) {
  // A fresh seed: parameterised questions get new numbers in review.
  const [seed] = useState(() => freshSeed(item.lesson, lastSeed));
  const scope = useMemo(() => lessonScope(item.lesson, seed), [item.lesson, seed]);
  const options = useMemo(() => buildOptions(item.question, scope, seed), [item.question, scope, seed]);
  const [pick, setPick] = useState<number | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [score, setScore] = useState<number | undefined>(undefined);
  const done = score !== undefined;
  const q = item.question;
  const hints: RenderedHints = {
    nudge: renderTemplate(q.hints.nudge, scope),
    buildsOn: q.hints.buildsOn ? renderTemplate(q.hints.buildsOn, scope) : null,
    partial: renderTemplate(q.hints.partial, scope),
  };
  const wrongPicks = selected.filter((i) => !options.find((o) => o.index === i)?.correct);

  const submit = () => {
    if (pick === null || done) return;
    const opt = options.find((o) => o.index === pick)!;
    const sel = [...selected, pick];
    setSelected(sel);
    setPick(null);
    if (opt.correct || sel.length >= 2) {
      const s = stepScore({ correct: opt.correct, attempt: sel.length as 1 | 2, hintsUsed });
      setScore(s);
      onDone({
        seed,
        selected: sel,
        hintsUsed,
        score: s,
        misconceptions: sel
          .map((i) => options.find((o) => o.index === i)!)
          .filter((o) => !o.correct && o.misconception)
          .map((o) => o.misconception!),
      });
    }
  };
  const openHint = (tier?: number) => {
    if (done) return;
    const t = tier ?? nextHintTier(hints, hintsUsed);
    if (t !== null && t > hintsUsed) {
      setHintsUsed(t);
      track({ type: 'hint-opened', lessonId: item.lesson.id, questionId: q.id, tier: t });
    }
  };

  useQuestionKeys({
    active: true,
    options,
    disabledIndices: wrongPicks,
    done,
    onPick: setPick,
    onSubmit: submit,
    onContinue: onNext,
    onHint: () => openHint(),
  });

  return (
    <div className="mt-4 space-y-4">
      <p className="text-sm text-muted">
        From{' '}
        <Link to={`/l/${item.lesson.id}`} className="underline">
          {lessonTitle}
        </Link>
      </p>
      <QuestionCard
        label="Review"
        buildsOnLabels={[]}
        context={item.step.standaloneContext ? renderTemplate(item.step.standaloneContext, scope) : undefined}
        prompt={renderTemplate(q.prompt, scope)}
        options={options}
        selected={selected}
        pick={pick}
        onPick={setPick}
        done={done}
        score={score}
        shortFor={(m) => renderTemplate(misconceptionShort(m), scope)}
        explanation={renderTemplate(q.explanation, scope)}
        onSubmit={submit}
        onContinue={onNext}
        continueLabel={isLast ? 'Finish review' : 'Next question'}
        autoFocus
      />
      <HintLadder hints={hints} used={hintsUsed} disabled={done} onOpen={openHint} />
    </div>
  );
}
