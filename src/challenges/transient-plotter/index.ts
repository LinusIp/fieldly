import type { ChallengeModule } from '../types';
import { TransientPlotter } from './Component';
import { transientLogic, type Config, type RawConfig, type Solution, type State } from './logic';

const transientPlotter: ChallengeModule<RawConfig, Config, State, Solution> = {
  ...transientLogic,
  Component: TransientPlotter,
};

export default transientPlotter;
