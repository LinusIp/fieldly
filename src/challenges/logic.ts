import { circuitLogic } from './circuit-builder/logic';
import type { ChallengeLogic } from './types';

/**
 * React-free logic for every challenge type, keyed by type. Used by the content validator and
 * by review/summary code. The UI loads full modules lazily through `registry.ts`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const challengeLogic: Record<string, ChallengeLogic<any, any, any, any>> = {
  [circuitLogic.type]: circuitLogic,
};
