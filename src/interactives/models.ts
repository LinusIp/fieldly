import { stepperLogic } from './algorithm-stepper/model';
import { circuitLogic } from './circuit-builder/model';
import { codeRunnerLogic } from './code-runner/model';
import { graphLogic } from './graph-manipulator/model';
import { parsonsLogic } from './parsons/model';
import { riemannLogic } from './riemann-sum/model';
import { seriesLogic } from './series-explorer/model';
import { transientLogic } from './transient-plotter/model';
import type { InteractiveModel } from './types';

/**
 * React-free models for every interactive, keyed by type (§9.3). Used by the content validator and
 * by tests. The UI loads full modules (model + view) lazily through `registry.ts`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const interactiveModels: Record<string, InteractiveModel<any, any, any, any>> = {
  [circuitLogic.type]: circuitLogic,
  [transientLogic.type]: transientLogic,
  [codeRunnerLogic.type]: codeRunnerLogic,
  [parsonsLogic.type]: parsonsLogic,
  [stepperLogic.type]: stepperLogic,
  [graphLogic.type]: graphLogic,
  [riemannLogic.type]: riemannLogic,
  [seriesLogic.type]: seriesLogic,
};
