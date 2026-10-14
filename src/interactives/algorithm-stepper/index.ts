import type { ChallengeModule } from '../types';
import { AlgorithmStepper } from './view';
import { stepperLogic, type Config, type RawConfig, type Solution, type State } from './model';

const algorithmStepper: ChallengeModule<RawConfig, Config, State, Solution> = {
  ...stepperLogic,
  Component: AlgorithmStepper,
};

export default algorithmStepper;
