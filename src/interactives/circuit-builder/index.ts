import type { InteractiveModule } from '../types';
import { circuitLogic, type Config, type RawConfig, type Solution, type State } from './model';
import { CircuitView } from './view';

const circuitBuilder: InteractiveModule<RawConfig, Config, State, Solution> = {
  ...circuitLogic,
  Component: CircuitView,
  board: true,
};

export default circuitBuilder;
