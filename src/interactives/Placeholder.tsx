import type { InteractiveViewProps } from './types';

/**
 * Stand-in view for interactives whose full view isn't built yet (§14 Phase 2: "interactives
 * render as placeholders that can be completed via the debug API"). It shows the model's own
 * plain-text description, so the screen still says what the circuit or plot is doing.
 */
export function makePlaceholder<C, S>(describe: (state: S, config: C) => string) {
  return function InteractivePlaceholder({ config, state }: InteractiveViewProps<C, S>) {
    let text: string;
    try {
      text = describe(state, config);
    } catch (e) {
      text = (e as Error).message;
    }
    return (
      <div
        className="rounded-xl border-2 border-dashed border-outline bg-surface-sunk p-4 text-sm"
        data-testid="interactive-placeholder"
      >
        <p className="font-medium">Interactive preview</p>
        <p className="mt-1 text-ink-2" aria-live="polite">
          {text}
        </p>
      </div>
    );
  };
}
