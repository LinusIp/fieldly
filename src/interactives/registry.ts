import type { InteractiveModule } from './types';

/** Lazy map: interactive type → module (model + view). Each type is its own chunk, loaded when first needed. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyModule = InteractiveModule<any, any, any, any>;

export const interactiveRegistry: Record<string, () => Promise<AnyModule>> = {
  'circuit-builder': () => import('./circuit-builder').then((m) => m.default),
  'transient-plotter': () => import('./transient-plotter').then((m) => m.default),
  'code-runner': () => import('./code-runner').then((m) => m.default),
  parsons: () => import('./parsons').then((m) => m.default),
  'algorithm-stepper': () => import('./algorithm-stepper').then((m) => m.default),
  'graph-manipulator': () => import('./graph-manipulator').then((m) => m.default),
  'riemann-sum': () => import('./riemann-sum').then((m) => m.default),
  'series-explorer': () => import('./series-explorer').then((m) => m.default),
};

const cache = new Map<string, Promise<AnyModule>>();

export function loadInteractive(type: string): Promise<AnyModule> {
  let p = cache.get(type);
  if (!p) {
    const loader = interactiveRegistry[type];
    if (!loader) return Promise.reject(new Error(`Unknown interactive type "${type}"`));
    p = loader().catch((e) => {
      cache.delete(type);
      throw e;
    });
    cache.set(type, p);
  }
  return p;
}
