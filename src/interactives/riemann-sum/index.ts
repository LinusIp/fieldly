import type { ChallengeModule } from '../types';
import { RiemannSum } from './view';
import { riemannLogic, type Config, type RawConfig, type Solution, type State } from './model';

const riemannSum: ChallengeModule<RawConfig, Config, State, Solution> = {
  ...riemannLogic,
  Component: RiemannSum,
};

export default riemannSum;
