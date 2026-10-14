import { Badge, Button } from '../components/ui';
import type { Step } from '../content/schema';
import { renderTemplate } from '../engine/template';
import type { Progress } from '../storage/schema';
import { maybeInsertExtras, pushFact, questionOf, recordGraded, type LessonCtx } from './attempt';
import { usePlayer, withAttempt } from './context';
import { QuestionRunner } from './QuestionRunner';
import { nsId } from '../content/types';

/** Count one sighting of a misconception (first wrong attempts and challenge feedback). */
export function noteMisconception(
  p: Progress,
  lctx: LessonCtx,
  id: string | undefined,
  now = new Date(),
): Progress {
  if (!id) return p;
  const key = nsId(lctx.subjectId, id);
  return {
    ...p,
    misconceptions: {
      ...p.misconceptions,
      [key]: { count: (p.misconceptions[key]?.count ?? 0) + 1, lastSeen: now.toISOString() },
    },
  };
}

/** "This builds on Q1: I = 2 A" — the auto tier-2 hint from `uses` plus the Facts panel (§2.4). */
export function buildsOnText(
  uses: string[] | undefined,
  label: (id: string) => string,
  factOf: (id: string) => string | undefined,
): string | null {
  if (!uses?.length) return null;
  const parts = uses.map((u) => {
    const f = factOf(u);
    return f ? `${label(u)}: ${f}` : label(u);
  });
  return `This builds on ${parts.join('; ')}.`;
}

export function BuildsOnChip({ labels }: { labels: string[] }) {
  if (!labels.length) return null;
  return (
    <span
      className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent"
      data-testid="builds-on"
    >
      ↩ builds on {labels.join(', ')}
    </span>
  );
}

/** One step of the chain (§8.1 `question`), including inserted remediation and bonus steps. */
export function QuestionScreen({ step }: { step: Step }) {
  const pl = usePlayer();
  const { lesson, lctx, attempt, scope, readOnly } = pl;
  const q = questionOf(step, attempt);
  const record = attempt.answers[step.id];
  const factOf = (id: string) => {
    const s = lesson.screens.find((x) => x.id === id) as Step | undefined;
    return s?.establishes && attempt.answers[id]?.correct !== undefined
      ? renderTemplate(s.establishes, scope)
      : undefined;
  };
  const isBonus = step.role === 'bonus';
  const roleBadge =
    step.role === 'check' ? (
      <Badge>Quick check</Badge>
    ) : step.role === 'remediation' ? (
      <Badge tone="warn">Inserted to help with {pl.stepLabel(step.remediates ?? '')}</Badge>
    ) : isBonus ? (
      <Badge tone="accent">Optional</Badge>
    ) : null;

  const skipBonus = () => {
    pl.setAttempt((a) => ({ ...a, skipped: [...a.skipped, step.id] }));
    pl.advance();
  };

  return (
    <article className="rounded-2xl border border-border bg-surface p-5 sm:p-6" data-testid="screen-question">
      <QuestionRunner
        key={`${step.id}:${q.id}`}
        question={q}
        scope={scope}
        seed={attempt.seed}
        mode="graded"
        record={record}
        readOnly={readOnly}
        misconceptionShort={pl.misconceptionShort}
        buildsOnAuto={buildsOnText(step.uses, pl.stepLabel, factOf)}
        analytics={{ lessonId: lesson.id, questionId: q.id }}
        header={
          <header className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              {pl.stepLabel(step.id)}
            </h2>
            {roleBadge}
            <BuildsOnChip labels={(step.uses ?? []).map(pl.stepLabel)} />
          </header>
        }
        onRecord={(rec, final, grade) =>
          pl.update((p) => {
            const a0 = p.lessons[lesson.id]?.attempt;
            if (!a0) return p;
            let a = {
              ...a0,
              answers: { ...a0.answers, [step.id]: { ...rec, variant: a0.chosenVariants[step.id] } },
            };
            if (!final) {
              if (grade.misconception && rec.attempts > (a0.answers[step.id]?.attempts ?? 0))
                p = noteMisconception(p, lctx, grade.misconception);
              return withAttempt(p, lesson.id, a);
            }
            a = pushFact(a, step.establishes, scope);
            if (rec.score !== undefined) {
              p = recordGraded(p, lctx, {
                stepId: step.id,
                question: q,
                concept: step.concept,
                score: rec.score,
                record: rec,
                misconception: rec.correct ? undefined : grade.misconception,
                context: 'lesson',
              });
              a = maybeInsertExtras(lctx, a, step.id);
            }
            return withAttempt(p, lesson.id, a);
          })
        }
        onContinue={pl.advance}
      />
      {isBonus && !record && !readOnly && (
        <div className="mt-3">
          <Button variant="ghost" onClick={skipBonus} data-testid="skip-bonus">
            Skip the bonus
          </Button>
        </div>
      )}
    </article>
  );
}
