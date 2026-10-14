import type { ChallengeModule } from '../types';
import { AlgorithmStepper } from './Component';
import { stepperLogic, type Config, type RawConfig, type Solution, type State } from './logic';

const algorithmStepper: ChallengeModule<RawConfig, Config, State, Solution> = {
  ...stepperLogic,
  Component: AlgorithmStepper,
};

export default algorithmStepper;
