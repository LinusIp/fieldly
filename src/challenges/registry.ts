import type { ChallengeModule } from './types';

/** Lazy map: challenge type → module. Each type is its own chunk, loaded when first needed. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyModule = ChallengeModule<any, any, any, any>;

export const challengeRegistry: Record<string, () => Promise<AnyModule>> = {
  'circuit-builder': () => import('./circuit-builder').then((m) => m.default),
  'transient-plotter': () => import('./transient-plotter').then((m) => m.default),
  'code-runner': () => import('./code-runner').then((m) => m.default),
  parsons: () => import('./parsons').then((m) => m.default),
  'algorithm-stepper': () => import('./algorithm-stepper').then((m) => m.default),
};

const cache = new Map<string, Promise<AnyModule>>();

export function loadChallenge(type: string): Promise<AnyModule> {
  let p = cache.get(type);
  if (!p) {
    const loader = challengeRegistry[type];
    if (!loader) return Promise.reject(new Error(`Unknown challenge type "${type}"`));
    p = loader().catch((e) => {
      cache.delete(type);
      throw e;
    });
    cache.set(type, p);
  }
  return p;
}
