import { useRef } from 'react';
import { Badge, Button, LinkIcon } from '../components/ui';
import type { Step } from '../content/schema';
import { nsId } from '../content/types';
import { addXp, earnsXp, itemXp } from '../engine/motivation';
import { renderTemplate } from '../engine/template';
import type { Progress } from '../storage/schema';
import { maybeInsertExtras, pushFact, questionOf, recordGraded, type LessonCtx } from './attempt';
import { usePlayer, withAttempt } from './context';
import { QuestionRunner } from './QuestionRunner';

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

/** "Q1", "Q1 and Q2", "Q1, Q2 and Q4". */
export function joinLabels(labels: string[]): string {
  return labels.length < 2 ? (labels[0] ?? '') : `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`;
}

/** Chain chip (§10.5): tint fill, violet outline, link icon — "Builds on Q1 and Q2". */
export function BuildsOnChip({ labels }: { labels: string[] }) {
  if (!labels.length) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-sm border-2 border-primary bg-surface-tint px-3 py-1 text-small font-extrabold text-primary-ink"
      data-testid="builds-on"
    >
      <LinkIcon className="h-4 w-4" />
      Builds on {joinLabels(labels)}
    </span>
  );
}

/** Step tag (§10.5): ink fill, white text — "Question 3". */
export function StepTag({ children }: { children: string }) {
  return <h2 className="rounded-sm bg-ink px-3 py-1 text-small font-extrabold text-ground">{children}</h2>;
}

/** "Q3" → "Question 3". */
export function longLabel(label: string): string {
  return /^Q\d+$/.test(label) ? `Question ${label.slice(1)}` : label;
}

/** One step of the chain (§8.1 `question`), including inserted remediation and bonus steps. */
export function QuestionScreen({ step }: { step: Step }) {
  const pl = usePlayer();
  const { lesson, lctx, attempt, scope, readOnly } = pl;
  const card = useRef<HTMLElement>(null);
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
      <Badge tone="warn">Extra step for {pl.stepLabel(step.remediates ?? '')}</Badge>
    ) : isBonus ? (
      <Badge tone="accent">Optional</Badge>
    ) : null;

  const skipBonus = () => {
    pl.setAttempt((a) => ({ ...a, skipped: [...a.skipped, step.id] }));
    pl.advance();
  };

  return (
    <article
      ref={card}
      className="flex flex-col gap-5 rounded-xl border-2 border-outline bg-surface p-5 shadow-s3 md:p-7"
      data-testid="screen-question"
    >
      <QuestionRunner
        key={`${step.id}:${q.id}`}
        question={q}
        scope={scope}
        seed={attempt.seed}
        mode="graded"
        record={record}
        readOnly={readOnly}
        popRef={card}
        misconceptionShort={pl.misconceptionShort}
        buildsOnAuto={buildsOnText(step.uses, pl.stepLabel, factOf)}
        analytics={{ lessonId: lesson.id, questionId: q.id }}
        header={
          <header className="flex flex-wrap items-center gap-2.5">
            <StepTag>{longLabel(pl.stepLabel(step.id))}</StepTag>
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
              // XP before the item history is updated, so the 24-hour rule sees the previous answer.
              if (earnsXp(p, `${lesson.id}#${q.id}`)) p = addXp(p, itemXp(q.difficulty, rec.score));
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
        <div>
          <Button variant="secondary" onClick={skipBonus} data-testid="skip-bonus">
            Skip the bonus
          </Button>
        </div>
      )}
    </article>
  );
}
