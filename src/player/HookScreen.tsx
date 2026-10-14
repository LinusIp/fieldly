import { Markdown } from '../components/Markdown';
import { Button } from '../components/ui';
import type { HookScreen as Hook } from '../content/schema';
import { renderTemplate } from '../engine/template';
import { usePlayer, withAttempt } from './context';
import { ExploreTasks, PredictionOutcome } from './ExploreTasks';
import { isDone, QuestionRunner } from './QuestionRunner';

/**
 * Hook (§2.3, §8.1): commit a prediction, then a reveal to run (with its tasks) or a try-first
 * comparison of sample attempts. The caption shows once the tasks are done. Never scored.
 */
export function HookScreen({ screen }: { screen: Hook }) {
  const pl = usePlayer();
  const { lesson, attempt, scope, readOnly } = pl;
  const key = `${screen.id}#predict`;
  const record = attempt.answers[key];
  const committed = isDone(record);
  const revealTasks = screen.reveal?.tasks ?? [];
  const revealDone = !screen.reveal || (attempt.explore[screen.id]?.taskIndex ?? 0) >= revealTasks.length;
  const finished = committed && revealDone;

  return (
    <article className="space-y-5" data-testid="screen-hook">
      <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="text-[1.1rem] leading-relaxed">
          <Markdown>{renderTemplate(screen.prompt, scope)}</Markdown>
        </div>
        <div className="mt-4">
          <QuestionRunner
            question={screen.predict}
            scope={scope}
            seed={attempt.seed}
            mode={screen.predict.graded === false ? 'prediction' : 'ask'}
            record={record}
            readOnly={readOnly || committed}
            active={!committed}
            misconceptionShort={pl.misconceptionShort}
            onRecord={(rec) =>
              pl.update((p) => {
                const a = p.lessons[lesson.id]?.attempt;
                return a ? withAttempt(p, lesson.id, { ...a, answers: { ...a.answers, [key]: rec } }) : p;
              })
            }
          />
        </div>
      </div>

      {committed && screen.reveal && (
        <section className="space-y-4" aria-label="Reveal" data-testid="reveal">
          <ExploreTasks
            screenId={screen.id}
            interactive={screen.reveal.interactive}
            tasks={revealTasks}
            instruction={screen.reveal.instruction}
          />
          {revealDone && (
            <div className="rounded-2xl border border-accent/40 bg-accent-soft/50 p-5" data-testid="caption">
              <Markdown>{renderTemplate(screen.reveal.caption, scope)}</Markdown>
              <PredictionOutcome q={screen.predict} record={record} scope={scope} seed={attempt.seed} />
            </div>
          )}
        </section>
      )}

      {committed && screen.compare && (
        <section className="space-y-3" aria-label="Compare attempts" data-testid="compare">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">How others tried it</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {screen.compare.attempts.map((a, i) => (
              <div key={i} className="rounded-xl border border-border bg-surface p-4">
                <h3 className="font-semibold">{a.label}</h3>
                <div className="mt-2 text-sm">
                  <Markdown>{renderTemplate(a.work, scope)}</Markdown>
                </div>
                <div className="mt-2 rounded-lg bg-surface-2 p-2 text-sm">
                  <Markdown>{renderTemplate(a.verdict, scope)}</Markdown>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-accent/40 bg-accent-soft/50 p-5">
            <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-accent">The method</h3>
            <Markdown>{renderTemplate(screen.compare.canonical, scope)}</Markdown>
          </div>
        </section>
      )}

      {finished && !readOnly && (
        <Button onClick={pl.advance} data-testid="continue">
          Continue
        </Button>
      )}
    </article>
  );
}
