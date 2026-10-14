import { Markdown } from '../../components/Markdown';
import { CheckIcon, CrossIcon } from '../../components/ui';
import type { ChallengeComponentProps } from '../types';
import type { Config, State } from './model';
import { cell, node, type Tone, type View } from './trace';

const TONE: Record<Tone, string> = {
  active: 'border-primary bg-surface-tint',
  done: 'border-correct bg-correct-tint',
  muted: 'border-outline bg-surface-sunk text-ink-2 opacity-60',
  found: 'border-correct bg-correct-tint font-bold',
  new: 'border-volt bg-volt-tint',
};

function ArrayCells({
  view,
  onPick,
  disabled,
}: {
  view: NonNullable<View['array']>;
  onPick(id: string): void;
  disabled: boolean;
}) {
  const ptrs = Object.entries(view.pointers ?? {});
  const many = view.values.length > 20;
  return (
    <div>
      {view.label && <div className="mb-1 text-xs font-medium text-ink-2">{view.label}</div>}
      <div
        className={`flex flex-wrap gap-1.5 ${many ? 'max-w-[34rem]' : ''}`}
        role="group"
        aria-label="Array"
      >
        {view.values.map((v, i) => {
          const tone = view.tones?.[i];
          const clickable = !disabled && (view.clickable ?? []).includes(i);
          const here = ptrs.filter(([, p]) => p === i).map(([k]) => k);
          const label = view.indexLabels ? view.indexLabels[i] : i;
          const content = (
            <>
              <span
                className={`flex ${many ? 'h-9 w-9 text-sm' : 'h-11 w-11'} items-center justify-center rounded-md border-2 font-mono ${tone ? TONE[tone] : 'border-outline bg-surface-sunk'}`}
              >
                {v === null ? '' : v}
              </span>
              {label !== '' && <span className="text-[10px] text-ink-2">{label}</span>}
              {here.length > 0 && (
                <span className="text-[10px] font-semibold text-primary-ink">{here.join(',')}</span>
              )}
            </>
          );
          return clickable ? (
            <button
              key={i}
              type="button"
              onClick={() => onPick(cell(i))}
              className="flex flex-col items-center gap-0.5 rounded-md hover:-translate-y-0.5 focus-visible:outline-3"
              aria-label={`${v === null ? 'empty slot' : v}${label !== '' ? ` at index ${label}` : ''}${here.length ? ` (${here.join(', ')})` : ''}`}
              data-target={cell(i)}
            >
              {content}
            </button>
          ) : (
            <div key={i} className="flex flex-col items-center gap-0.5">
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ListNodes({
  view,
  onPick,
  disabled,
}: {
  view: NonNullable<View['list']>;
  onPick(id: string): void;
  disabled: boolean;
}) {
  const ptrs = Object.entries(view.pointers ?? {});
  const byId = new Map(view.nodes.map((n) => [n.id, n]));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-start gap-3">
        {view.nodes.map((n) => {
          const here = ptrs.filter(([, p]) => p === n.id).map(([k]) => k);
          const clickable = !disabled && (view.clickable ?? []).includes(n.id);
          const box = (
            <span
              className={`flex items-center overflow-hidden rounded-md border-2 font-mono ${here.includes('curr') ? 'border-primary' : 'border-outline'}`}
            >
              <span className="px-3 py-2">{n.value}</span>
              <span className="border-l border-outline bg-surface-sunk px-2 py-2 text-xs text-ink-2">
                → {n.next === null ? 'None' : byId.get(n.next)?.value}
              </span>
            </span>
          );
          return (
            <div key={n.id} className="flex flex-col items-center gap-1">
              {clickable ? (
                <button
                  type="button"
                  onClick={() => onPick(node(n.id))}
                  data-target={node(n.id)}
                  aria-label={`node ${n.value}`}
                  className="rounded-md hover:-translate-y-0.5"
                >
                  {box}
                </button>
              ) : (
                box
              )}
              <span className="h-4 text-[11px] font-semibold text-primary-ink">{here.join(', ')}</span>
            </div>
          );
        })}
      </div>
      <div className="text-xs text-ink-2">
        {ptrs.map(([k, p]) => `${k} = ${p === null ? 'None' : byId.get(p)?.value}`).join(', ')}
      </div>
    </div>
  );
}

export function ViewPanel({
  view,
  onPick,
  disabled,
}: {
  view: View;
  onPick(id: string): void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-4">
      {view.input && (
        <div
          className="font-mono text-lg tracking-widest"
          aria-label={`Input ${view.input.text}, reading position ${view.input.index}`}
        >
          {view.input.text.split('').map((ch, i) => (
            <span
              key={i}
              className={
                i === view.input!.index
                  ? 'rounded bg-primary px-1 text-on-primary'
                  : i < view.input!.index
                    ? 'text-ink-2'
                    : ''
              }
            >
              {ch}
            </span>
          ))}
        </div>
      )}
      {view.array && <ArrayCells view={view.array} onPick={onPick} disabled={disabled} />}
      {view.list && <ListNodes view={view.list} onPick={onPick} disabled={disabled} />}
      {view.stack && (
        <div>
          <div className="mb-1 text-xs font-medium text-ink-2">{view.stack.label}</div>
          <div className="flex min-h-11 items-center gap-1 rounded-md border-2 border-dashed border-outline px-2 py-1 font-mono">
            {view.stack.items.length === 0 ? (
              <span className="text-sm text-ink-2">empty</span>
            ) : (
              view.stack.items.map((x, i) => (
                <span
                  key={i}
                  className={`rounded border-2 px-2 py-1 ${i === view.stack!.items.length - 1 ? 'border-primary bg-surface-tint' : 'border-outline'}`}
                >
                  {x}
                </span>
              ))
            )}
          </div>
        </div>
      )}
      {view.vars && (
        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {Object.entries(view.vars).map(([k, v]) => (
            <div key={k}>
              <dt className="inline text-ink-2">{k}: </dt>
              <dd className="inline font-mono">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export function AlgorithmStepper({
  config,
  state,
  disabled,
  onStateChange,
}: ChallengeComponentProps<Config, State>) {
  const steps = config.trace.steps;
  const done = state.step >= steps.length;
  const current = done ? undefined : steps[state.step];
  const view = current ? current.view : config.trace.final;

  const pick = (id: string) => {
    if (!current || disabled) return;
    if (id === current.correct)
      onStateChange({ step: state.step + 1, mistakes: state.mistakes, lastNote: current.after });
    else
      onStateChange({
        ...state,
        mistakes: state.mistakes + 1,
        lastWrong: current.wrong(id),
        lastNote: undefined,
      });
  };

  return (
    <div className="space-y-4" data-testid="stepper">
      <div className="flex items-center justify-between text-sm text-ink-2">
        <span>
          Step {Math.min(state.step + 1, steps.length)} of {steps.length}
        </span>
        <span>
          Mistakes: <strong className="text-ink">{state.mistakes}</strong>
        </span>
      </div>
      <ViewPanel view={view} onPick={pick} disabled={disabled || done} />
      {current && (
        <div className="space-y-2">
          <p className="font-medium" data-testid="stepper-prompt">
            {current.prompt}
          </p>
          {current.actions && (
            <div className="flex flex-wrap gap-2">
              {current.actions.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => pick(a.id)}
                  className="rounded-lg border-2 border-outline px-3 py-1.5 text-sm hover:border-primary hover:bg-surface-tint"
                  data-target={a.id}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div aria-live="polite" className="min-h-[1.5rem] text-sm">
        {state.lastWrong && (
          <p className="flex items-start gap-2 rounded-lg bg-wrong-tint px-3 py-2 text-ink">
            <CrossIcon className="mt-0.5 h-4 w-4 shrink-0" />{' '}
            <span>Not that one. {state.lastWrong} Try again.</span>
          </p>
        )}
        {!state.lastWrong && state.lastNote && (
          <p className="flex items-start gap-2 text-ink">
            <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" /> <span>{state.lastNote}</span>
          </p>
        )}
      </div>
      {done && (
        <div className="rounded-lg bg-correct-tint px-3 py-2 text-sm" data-testid="stepper-done">
          <Markdown>{`**Done.** ${config.trace.summary}`}</Markdown>
        </div>
      )}
    </div>
  );
}
