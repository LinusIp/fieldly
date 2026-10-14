import type { ChallengeModule } from '../types';
import { SeriesExplorer } from './view';
import { seriesLogic, type Config, type RawConfig, type Solution, type State } from './model';

const seriesExplorer: ChallengeModule<RawConfig, Config, State, Solution> = {
  ...seriesLogic,
  Component: SeriesExplorer,
};

export default seriesExplorer;
