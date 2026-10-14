import { makePlaceholder } from '../Placeholder';
import type { InteractiveModule } from '../types';
import { circuitLogic, describeState, type Config, type RawConfig, type Solution, type State } from './model';

// The full circuit view arrives with the interactive framework (§14 Phase 3).
const circuitBuilder: InteractiveModule<RawConfig, Config, State, Solution> = {
  ...circuitLogic,
  Component: makePlaceholder<Config, State>(describeState),
  placeholder: true,
};

export default circuitBuilder;
