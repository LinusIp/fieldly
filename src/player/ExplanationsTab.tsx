import { Markdown } from '../components/Markdown';
import type { Question } from '../content/schema';
import type { Scope } from '../engine/expr';
import { renderTemplate } from '../engine/template';
import type { AnswerRecord } from '../storage/schema';
import { widgetFor } from '../widgets/registry';
import { challengeScope, entryMap, isStep, questionOf } from './attempt';
import { usePlayer } from './context';
import { answerText, isDone } from './QuestionRunner';

function describe(q: Question, answer: unknown, scope: Scope, seed: number): string {
  const w = widgetFor(q.kind);
  if (!w || answer == null) return '—';
  try {
    return answerText(w.describe(q, answer, { scope, seed }));
  } catch {
    return '—';
  }
}

function Item({
  title,
  q,
  rec,
  scope,
  seed,
}: {
  title: string;
  q: Question;
  rec?: AnswerRecord;
  scope: Scope;
  seed: number;
}) {
  if (!rec || !isDone(rec))
    return (
      <section className="rounded-xl border-2 border-dashed border-outline p-4 text-sm">
        <h3 className="font-semibold text-ink-2">{title}</h3>
        <p className="text-ink-2">Answer this question to unlock its explanation.</p>
      </section>
    );
  const w = widgetFor(q.kind);
  let correct = '—';
  try {
    if (w) correct = describe(q, w.correctAnswer(q, { scope, seed }), scope, seed);
  } catch {
    /* keep — */
  }
  return (
    <section className="rounded-xl border-2 border-outline bg-surface p-5" data-testid="explanation-item">
      <h3 className="text-h3 text-ink">{title}</h3>
      <div className="mt-2">
        <Markdown>{renderTemplate(q.prompt, scope)}</Markdown>
      </div>
      <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-3">
        <dt className="text-ink-2">Your answer</dt>
        <dd>
          {describe(q, rec.answer, scope, seed)} {rec.score !== undefined && `(score ${rec.score})`}
        </dd>
        {q.kind !== 'explain' && (
          <>
            <dt className="text-ink-2">Correct answer</dt>
            <dd>{correct}</dd>
          </>
        )}
      </dl>
      {q.explanation && (
        <div className="mt-3 rounded-lg bg-surface-sunk p-4">
          <Markdown>{renderTemplate(q.explanation, scope)}</Markdown>
        </div>
      )}
    </section>
  );
}

/** Every question of the attempt with its explanation, unlocked once answered (§8.1). */
export function ExplanationsTab() {
  const { lesson, attempt, scope, stepLabel } = usePlayer();
  const map = entryMap(lesson);
  const items = attempt.sequence.flatMap((id) => {
    const e = map.get(id);
    if (!e) return [];
    if (isStep(e)) {
      if (attempt.skipped.includes(id)) return [];
      return [
        <Item
          key={id}
          title={stepLabel(id)}
          q={questionOf(e, attempt)}
          rec={attempt.answers[id]}
          scope={scope}
          seed={attempt.seed}
        />,
      ];
    }
    if (e.type === 'explore')
      return e.tasks.flatMap((t, i) =>
        'ask' in t
          ? [
              <Item
                key={`${id}#${i}`}
                title="Explore question"
                q={t.ask}
                rec={attempt.answers[`${id}#t${i}`]}
                scope={scope}
                seed={attempt.seed}
              />,
            ]
          : [],
      );
    if (e.type === 'challenge') {
      const c = attempt.challenges[id];
      const done = c && (c.solved || c.usedSolution);
      const v = c ? e.variants[c.variant as 'easier' | 'standard' | 'harder'] : undefined;
      return [
        <section
          key={id}
          className={`rounded-xl border-2 p-5 ${done ? 'border-outline bg-surface' : 'border-dashed border-outline text-sm'}`}
        >
          <h3 className="text-h3 text-ink">Challenge — {e.title}</h3>
          {done && v ? (
            <div className="mt-3 rounded-lg bg-surface-sunk p-4">
              <Markdown>{renderTemplate(v.explanation, challengeScope(lesson, e, attempt.seed))}</Markdown>
            </div>
          ) : (
            <p className="text-ink-2">
              Solve the challenge (or show its solution) to unlock its explanation.
            </p>
          )}
        </section>,
      ];
    }
    return [];
  });
  return (
    <div className="max-w-[760px] space-y-4" data-testid="explanations-tab">
      <p className="text-sm text-ink-2">Explanations for every question in this attempt.</p>
      {items}
    </div>
  );
}
