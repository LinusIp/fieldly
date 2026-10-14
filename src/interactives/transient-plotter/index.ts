import type { ChallengeModule } from '../types';
import { TransientPlotter } from './view';
import { transientLogic, type Config, type RawConfig, type Solution, type State } from './model';

const transientPlotter: ChallengeModule<RawConfig, Config, State, Solution> = {
  ...transientLogic,
  Component: TransientPlotter,
};

export default transientPlotter;
