import { useRef } from 'react';
import { Markdown } from '../components/Markdown';
import { Button } from '../components/ui';
import type { HookScreen as Hook } from '../content/schema';
import { renderTemplate } from '../engine/template';
import { usePlayer, withAttempt } from './context';
import { ScreenTitle, TakeawayCard } from './ExploreScreen';
import { ExploreTasks, PredictionOutcome } from './ExploreTasks';
import { isDone, QuestionRunner } from './QuestionRunner';
import { StepTag } from './QuestionScreen';

/**
 * Hook (§2.3, §8.1): commit a prediction, then a reveal to run (with its tasks) or a try-first
 * comparison of sample attempts. The caption shows once the tasks are done. Never scored.
 */
export function HookScreen({ screen }: { screen: Hook }) {
  const pl = usePlayer();
  const { lesson, attempt, scope, readOnly } = pl;
  const card = useRef<HTMLElement>(null);
  const key = `${screen.id}#predict`;
  const record = attempt.answers[key];
  const committed = isDone(record);
  const revealTasks = screen.reveal?.tasks ?? [];
  const revealDone = !screen.reveal || (attempt.explore[screen.id]?.taskIndex ?? 0) >= revealTasks.length;
  const finished = committed && revealDone;
  const cont = finished && !readOnly && (
    <Button onClick={pl.advance} className="min-h-[56px] self-start px-8 text-[20px]" data-testid="continue">
      Continue
    </Button>
  );

  return (
    <article className="flex flex-col gap-7" data-testid="screen-hook">
      <section
        ref={card}
        className="flex max-w-[860px] flex-col gap-5 rounded-xl border-2 border-outline bg-surface p-5 shadow-s3 md:p-7"
      >
        <header>
          <StepTag>{screen.compare ? 'Try it first' : 'Predict'}</StepTag>
        </header>
        <div className="max-w-[720px] text-[18px] font-semibold">
          <Markdown>{renderTemplate(screen.prompt, scope)}</Markdown>
        </div>
        <QuestionRunner
          question={screen.predict}
          scope={scope}
          seed={attempt.seed}
          mode={screen.predict.graded === false ? 'prediction' : 'ask'}
          record={record}
          compact
          readOnly={readOnly || committed}
          active={!committed}
          popRef={card}
          misconceptionShort={pl.misconceptionShort}
          onRecord={(rec) =>
            pl.update((p) => {
              const a = p.lessons[lesson.id]?.attempt;
              return a ? withAttempt(p, lesson.id, { ...a, answers: { ...a.answers, [key]: rec } }) : p;
            })
          }
        />
      </section>

      {committed && screen.reveal && (
        <section aria-label="Reveal" data-testid="reveal">
          <ExploreTasks
            screenId={screen.id}
            interactive={screen.reveal.interactive}
            tasks={revealTasks}
            title={
              screen.reveal.instruction ? (
                <ScreenTitle>{renderTemplate(screen.reveal.instruction, scope)}</ScreenTitle>
              ) : undefined
            }
            after={
              revealDone && (
                <>
                  <PredictionOutcome q={screen.predict} record={record} scope={scope} seed={attempt.seed} />
                  <TakeawayCard label="What happened" testId="caption">
                    {renderTemplate(screen.reveal.caption, scope)}
                  </TakeawayCard>
                  {cont}
                </>
              )
            }
          />
        </section>
      )}

      {committed && screen.compare && (
        <section
          className="flex flex-col gap-4"
          aria-labelledby={`${screen.id}-compare`}
          data-testid="compare"
        >
          <h2 id={`${screen.id}-compare`} className="text-h2">
            How others tried it
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {screen.compare.attempts.map((a, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-lg border-2 border-outline bg-surface p-4">
                <h3 className="text-h3">{a.label}</h3>
                <Markdown>{renderTemplate(a.work, scope)}</Markdown>
                <div className="rounded-md bg-surface-sunk p-3 text-small font-semibold">
                  <Markdown>{renderTemplate(a.verdict, scope)}</Markdown>
                </div>
              </div>
            ))}
          </div>
          <TakeawayCard label="The method">{renderTemplate(screen.compare.canonical, scope)}</TakeawayCard>
          {cont}
        </section>
      )}
      {finished && !screen.reveal && !screen.compare && cont}
    </article>
  );
}
