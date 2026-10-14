import type { ChallengeModule } from '../types';
import { GraphManipulator } from './Component';
import { graphLogic, type Config, type RawConfig, type Solution, type State } from './logic';

const graphManipulator: ChallengeModule<RawConfig, Config, State, Solution> = {
  ...graphLogic,
  Component: GraphManipulator,
};

export default graphManipulator;
