import type { ChallengeModule } from '../types';
import { Parsons } from './view';
import { parsonsLogic, type ConfigWithSolution, type RawConfig, type Solution, type State } from './model';

const parsons: ChallengeModule<RawConfig, ConfigWithSolution, State, Solution> = {
  ...parsonsLogic,
  Component: Parsons,
};

export default parsons;
