import { stepperLogic } from './algorithm-stepper/logic';
import { circuitLogic } from './circuit-builder/logic';
import { codeRunnerLogic } from './code-runner/logic';
import { parsonsLogic } from './parsons/logic';
import { transientLogic } from './transient-plotter/logic';
import type { ChallengeLogic } from './types';

/**
 * React-free logic for every challenge type, keyed by type. Used by the content validator and
 * by tests. The UI loads full modules lazily through `registry.ts`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const challengeLogic: Record<string, ChallengeLogic<any, any, any, any>> = {
  [circuitLogic.type]: circuitLogic,
  [transientLogic.type]: transientLogic,
  [codeRunnerLogic.type]: codeRunnerLogic,
  [parsonsLogic.type]: parsonsLogic,
  [stepperLogic.type]: stepperLogic,
};
