import type { ChallengeModule } from '../types';
import { CircuitBuilder } from './Component';
import { circuitLogic, type Config, type RawConfig, type Solution, type State } from './logic';

const circuitBuilder: ChallengeModule<RawConfig, Config, State, Solution> = {
  ...circuitLogic,
  Component: CircuitBuilder,
};

export default circuitBuilder;
