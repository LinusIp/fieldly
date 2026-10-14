import type { ChallengeModule } from '../types';
import { GraphManipulator } from './view';
import { graphLogic, type Config, type RawConfig, type Solution, type State } from './model';

const graphManipulator: ChallengeModule<RawConfig, Config, State, Solution> = {
  ...graphLogic,
  Component: GraphManipulator,
};

export default graphManipulator;
