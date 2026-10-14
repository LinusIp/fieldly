import type { ChallengeModule } from '../types';
import { Parsons } from './Component';
import { parsonsLogic, type ConfigWithSolution, type RawConfig, type Solution, type State } from './logic';

const parsons: ChallengeModule<RawConfig, ConfigWithSolution, State, Solution> = {
  ...parsonsLogic,
  Component: Parsons,
};

export default parsons;
