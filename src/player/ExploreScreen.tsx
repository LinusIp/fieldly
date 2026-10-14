import { useMemo, useState } from 'react';
import { Markdown } from '../components/Markdown';
import { Button } from '../components/ui';
import type { ConceptScreen as Concept, ExploreScreen as Explore, InteractiveRef } from '../content/schema';
import { renderTemplate } from '../engine/template';
import { resolveConfig } from '../interactives/check';
import { InteractiveFrame, WithInteractive } from '../interactives/InteractiveHost';
import type { AnyModule } from '../interactives/registry';
import { pushFact } from './attempt';
import { usePlayer } from './context';
import { ExploreTasks } from './ExploreTasks';

/** A screen title in prompt type (§10.4). */
export function ScreenTitle({ children }: { children: string }) {
  return (
    <div className="prompt max-w-[720px] text-[24px] leading-[1.25] font-extrabold tracking-[-0.015em] md:text-[28px]">
      <Markdown>{children}</Markdown>
    </div>
  );
}

/** Takeaways and captions: a tint card with a violet outline. */
export function TakeawayCard({
  label,
  children,
  testId,
}: {
  label: string;
  children: string;
  testId?: string;
}) {
  return (
    <div className="rounded-lg border-2 border-primary bg-surface-tint p-4" data-testid={testId}>
      <span className="text-small font-extrabold text-primary-ink">{label}</span>
      <div className="mt-1">
        <Markdown>{children}</Markdown>
      </div>
    </div>
  );
}

/** Explore (§8.1): the interactive and its gated goals; the takeaway joins the Facts panel at the end. */
export function ExploreScreen({ screen }: { screen: Explore }) {
  const pl = usePlayer();
  const { attempt, scope, readOnly } = pl;
  const done = (attempt.explore[screen.id]?.taskIndex ?? 0) >= screen.tasks.length;
  const onAllDone = () =>
    pl.setAttempt((a) => {
      const withFact = pushFact(a, screen.takeaway, scope);
      const prev = withFact.explore[screen.id];
      return prev
        ? { ...withFact, explore: { ...withFact.explore, [screen.id]: { ...prev, done: true } } }
        : withFact;
    });
  return (
    <article data-testid="screen-explore">
      <ExploreTasks
        screenId={screen.id}
        interactive={screen.interactive}
        tasks={screen.tasks}
        onAllDone={onAllDone}
        title={<ScreenTitle>{renderTemplate(screen.intro, scope)}</ScreenTitle>}
        after={
          done && (
            <>
              <TakeawayCard label="Takeaway" testId="takeaway">
                {renderTemplate(screen.takeaway, scope)}
              </TakeawayCard>
              {!readOnly && (
                <Button
                  onClick={pl.advance}
                  className="min-h-[56px] self-start px-8 text-[20px]"
                  data-testid="continue"
                >
                  Continue
                </Button>
              )}
            </>
          )
        }
      />
    </article>
  );
}

function FreeInteractive({ mod, iref: r }: { mod: AnyModule; iref: InteractiveRef }) {
  const { scope } = usePlayer();
  const config = useMemo(() => resolveConfig(mod, r.config, scope), [mod, r.config, scope]);
  const [state, setState] = useState<unknown>(() => mod.initialState(config));
  return (
    <InteractiveFrame
      mod={mod}
      config={config}
      mode={r.mode ?? 'view'}
      state={state}
      onStateChange={setState}
    />
  );
}

/** Concept card (§8.1): names what was just discovered; Continue is enabled immediately. */
export function ConceptScreen({ screen }: { screen: Concept }) {
  const pl = usePlayer();
  return (
    <article className="flex flex-col gap-5" data-testid="screen-concept">
      <div className="rounded-xl border-2 border-outline bg-surface p-5 text-body shadow-s3 md:p-7">
        <span className="mb-3 inline-block rounded-sm bg-ink px-3 py-1 text-small font-extrabold text-ground">
          Name it
        </span>
        <div className="max-w-[720px] text-[18px]">
          <Markdown>{renderTemplate(screen.body, pl.scope)}</Markdown>
        </div>
      </div>
      {screen.visual && (
        <WithInteractive type={screen.visual.type}>
          {(mod) => <FreeInteractive mod={mod} iref={screen.visual!} />}
        </WithInteractive>
      )}
      {!pl.readOnly && (
        <Button
          onClick={pl.advance}
          className="min-h-[56px] self-start px-8 text-[20px]"
          data-testid="continue"
        >
          Continue
        </Button>
      )}
    </article>
  );
}
