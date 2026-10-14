import type { ChallengeModule } from '../types';
import { CodeRunner } from './view';
import { codeRunnerLogic, type Config, type RawConfig, type Solution, type State } from './model';
import { runTests } from './runner';

const codeRunner: ChallengeModule<RawConfig, Config, State, Solution> = {
  ...codeRunnerLogic,
  Component: CodeRunner,
  /** "Check" always runs the tests on the current code first. */
  async beforeCheck(state, config) {
    const results = await runTests(state.lang, state.code[state.lang], config);
    return { ...state, results };
  },
};

export default codeRunner;
