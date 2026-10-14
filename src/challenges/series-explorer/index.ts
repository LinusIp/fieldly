import type { ChallengeModule } from '../types';
import { SeriesExplorer } from './Component';
import { seriesLogic, type Config, type RawConfig, type Solution, type State } from './logic';

const seriesExplorer: ChallengeModule<RawConfig, Config, State, Solution> = {
  ...seriesLogic,
  Component: SeriesExplorer,
};

export default seriesExplorer;
