import { useMemo, useState } from 'react';
import { Markdown } from '../components/Markdown';
import { Button } from '../components/ui';
import type { ConceptScreen as Concept, ExploreScreen as Explore } from '../content/schema';
import { renderTemplate } from '../engine/template';
import { resolveConfig } from '../interactives/check';
import { InteractiveFrame, WithInteractive } from '../interactives/InteractiveHost';
import type { AnyModule } from '../interactives/registry';
import type { InteractiveRef } from '../content/schema';
import { pushFact } from './attempt';
import { usePlayer } from './context';
import { ExploreTasks } from './ExploreTasks';

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
    <article className="space-y-4" data-testid="screen-explore">
      <div className="text-[1.05rem] leading-relaxed">
        <Markdown>{renderTemplate(screen.intro, scope)}</Markdown>
      </div>
      <ExploreTasks
        screenId={screen.id}
        interactive={screen.interactive}
        tasks={screen.tasks}
        onAllDone={onAllDone}
      />
      {done && (
        <div className="rounded-2xl border border-accent/40 bg-accent-soft/50 p-4" data-testid="takeaway">
          <span className="text-xs font-semibold uppercase tracking-wide text-accent">Takeaway</span>
          <p className="mt-1">
            <Markdown inline>{renderTemplate(screen.takeaway, scope)}</Markdown>
          </p>
        </div>
      )}
      {done && !readOnly && (
        <Button onClick={pl.advance} data-testid="continue">
          Continue
        </Button>
      )}
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
    <article className="space-y-4" data-testid="screen-concept">
      <div className="rounded-2xl border border-border bg-surface p-5 text-[1.05rem] leading-relaxed sm:p-6">
        <Markdown>{renderTemplate(screen.body, pl.scope)}</Markdown>
      </div>
      {screen.visual && (
        <WithInteractive type={screen.visual.type}>
          {(mod) => <FreeInteractive mod={mod} iref={screen.visual!} />}
        </WithInteractive>
      )}
      {!pl.readOnly && (
        <Button onClick={pl.advance} data-testid="continue">
          Continue
        </Button>
      )}
    </article>
  );
}
