import type { ChallengeModule } from '../types';
import { CircuitBuilder } from './view';
import { circuitLogic, type Config, type RawConfig, type Solution, type State } from './model';

const circuitBuilder: ChallengeModule<RawConfig, Config, State, Solution> = {
  ...circuitLogic,
  Component: CircuitBuilder,
};

export default circuitBuilder;
