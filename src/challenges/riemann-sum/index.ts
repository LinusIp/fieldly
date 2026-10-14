import type { ChallengeModule } from '../types';
import { RiemannSum } from './Component';
import { riemannLogic, type Config, type RawConfig, type Solution, type State } from './logic';

const riemannSum: ChallengeModule<RawConfig, Config, State, Solution> = {
  ...riemannLogic,
  Component: RiemannSum,
};

export default riemannSum;
