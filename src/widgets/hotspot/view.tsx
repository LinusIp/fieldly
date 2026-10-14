import { useMemo } from 'react';
import { InteractiveFrame, useInteractiveModule } from '../../interactives/InteractiveHost';
import { resolveConfig } from '../../interactives/check';
import { Loading } from '../../components/ui';
import type { WidgetViewProps } from '../types';
import { Mark, markClass } from '../ui';
import type { HotspotAnswer, HotspotQuestion } from './model';

/**
 * Tap elements of an interactive shown in `view` mode (§9.2). The same targets are listed as
 * buttons underneath, so the question works by keyboard and with any view (§11).
 */
export function HotspotView({
  question: q,
  ctx,
  disabled,
  answer,
  onChange,
  marks,
  reveal,
}: WidgetViewProps<HotspotQuestion, HotspotAnswer>) {
  const { mod, error } = useInteractiveModule(q.on.type);
  const resolved = useMemo(() => {
    if (!mod) return undefined;
    try {
      const config = resolveConfig(mod, q.on.config, ctx.scope);
      return { config, state: mod.initialState(config) };
    } catch (e) {
      return { error: e as Error };
    }
  }, [mod, q.on.config, ctx.scope]);
  const tapped = reveal ? (reveal.learner ?? []) : (answer ?? []);
  const tap = (id: string) => {
    if (disabled || reveal) return;
    let next: string[];
    if (tapped.includes(id)) next = tapped.filter((x) => x !== id);
    else next = [...tapped, id];
    onChange(next.length ? next : null);
  };
  const markFor = (id: string): boolean | undefined => {
    if (reveal) return q.answer.includes(id) ? true : tapped.includes(id) ? false : undefined;
    if (!marks || !marks.answer.includes(id) || !tapped.includes(id)) return undefined;
    return q.ordered ? undefined : marks.answer.includes(id) && marks.grade.parts?.[marks.answer.indexOf(id)];
  };
  if (error) return <p className="text-bad">Could not load the interactive: {error.message}</p>;
  if (!mod || !resolved) return <Loading what="Loading the diagram" />;
  if ('error' in resolved) return <p className="text-bad">{resolved.error!.message}</p>;
  return (
    <div data-testid="hotspot">
      <InteractiveFrame
        mod={mod}
        config={resolved.config}
        mode="view"
        state={resolved.state}
        disabled
        targets={q.targets}
        onTap={tap}
      />
      <p className="mt-3 text-sm text-muted">
        {q.ordered
          ? 'Tap the elements in order. Tap one again to remove it.'
          : q.answer.length > 1
            ? 'Tap every element that applies. Tap again to undo.'
            : 'Tap the element. Tap again to undo.'}
      </p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Elements">
        {q.targets.map((id) => {
          const pos = tapped.indexOf(id);
          const mark = markFor(id);
          const state = mark === true ? 'ok' : mark === false ? 'bad' : pos >= 0 ? 'picked' : 'none';
          return (
            <button
              key={id}
              type="button"
              aria-pressed={pos >= 0}
              disabled={disabled || !!reveal}
              onClick={() => tap(id)}
              className={`flex min-h-[44px] min-w-[56px] items-center justify-center gap-1 rounded-lg border-2 px-3 font-mono font-semibold ${markClass(state)}`}
              data-target={id}
            >
              {id}
              {q.ordered && pos >= 0 && <span className="text-xs text-muted">#{pos + 1}</span>}
            </button>
          );
        })}
      </div>
      {reveal && (
        <p className="mt-2 flex items-center gap-2 text-sm">
          <Mark ok label="Answer:" /> {q.answer.join(q.ordered ? ' → ' : ', ')}
        </p>
      )}
    </div>
  );
}
