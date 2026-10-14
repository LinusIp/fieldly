import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Loading } from '../components/ui';
import type { Scope } from '../engine/expr';
import { useProgress } from '../storage/progress';
import { resolveConfig } from './check';
import { loadInteractive, type AnyModule } from './registry';
import type { InteractiveMode } from './types';

/** Load an interactive module by type (each type is its own chunk). */
export function useInteractiveModule(type: string): { mod?: AnyModule; error?: Error } {
  const [s, setS] = useState<{ type?: string; mod?: AnyModule; error?: Error }>({});
  useEffect(() => {
    let alive = true;
    loadInteractive(type).then(
      (mod) => alive && setS({ type, mod }),
      (error: Error) => alive && setS({ type, error }),
    );
    return () => {
      alive = false;
    };
  }, [type]);
  return s.type === type ? { mod: s.mod, error: s.error } : {};
}

/** Resolve a raw config for this scope once per (module, config, scope). */
export function useResolvedConfig(
  mod: AnyModule | undefined,
  raw: unknown,
  scope: Scope,
  solution?: unknown,
) {
  return useMemo(() => {
    if (!mod) return { config: undefined, error: undefined };
    try {
      return { config: resolveConfig(mod, raw, scope, solution), error: undefined };
    } catch (e) {
      return { config: undefined, error: e as Error };
    }
  }, [mod, raw, scope, solution]);
}

/** Waits for the module, then renders `children(mod)`. */
export function WithInteractive({ type, children }: { type: string; children(mod: AnyModule): ReactNode }) {
  const { mod, error } = useInteractiveModule(type);
  if (error) return <p className="text-ink">Could not load the interactive: {error.message}</p>;
  if (!mod) return <Loading what="Loading the interactive" />;
  return <>{children(mod)}</>;
}

/**
 * Renders an interactive view with its plain-text description in a live region (§11). A
 * placeholder view (§14 Phase 2) is labelled as such so nothing claims to be more than it is.
 */
export function InteractiveFrame({
  mod,
  config,
  mode,
  state,
  onStateChange,
  disabled = false,
  showingSolution,
  targets,
  onTap,
}: {
  mod: AnyModule;
  config: unknown;
  mode: InteractiveMode;
  state: unknown;
  onStateChange?(s: unknown): void;
  disabled?: boolean;
  showingSolution?: boolean;
  targets?: string[];
  onTap?(id: string): void;
}) {
  const settings = useProgress((s) => s.progress.settings);
  const Comp = mod.Component;
  let description = '';
  try {
    description = mod.describeState(state, config);
  } catch {
    /* the view shows its own error */
  }
  return (
    <div
      className={`overflow-hidden rounded-xl border-2 border-outline shadow-s3 ${mod.board ? 'bg-board' : 'bg-surface p-3 sm:p-4'}`}
      data-testid="interactive"
      data-type={mod.type}
    >
      {mod.placeholder && (
        <p className="mb-2 text-small font-semibold text-ink-2">
          The hands-on view for this interactive is still being built; for now it shows a written description
          of the model.
        </p>
      )}
      <Comp
        mode={mode}
        config={config}
        state={state}
        disabled={disabled}
        showingSolution={showingSolution}
        reducedMotion={settings.reducedMotion}
        codeLang={settings.codeLang}
        targets={targets}
        onTap={onTap}
        onStateChange={(s: unknown) => onStateChange?.(s)}
      />
      {!mod.placeholder && (
        <div className="sr-only" aria-live="polite" data-testid="interactive-description">
          {description}
        </div>
      )}
    </div>
  );
}
