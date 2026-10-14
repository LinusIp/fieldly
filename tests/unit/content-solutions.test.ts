import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateContent } from '../../scripts/validate-content';
import { challengeLogic } from '../../src/challenges/logic';
import { makeResolveCtx } from '../../src/challenges/types';
import { evalBoolean, evalNumber } from '../../src/engine/expr';
import { applyDerived, enumerateParamValues } from '../../src/engine/params';
import { renderTemplate } from '../../src/engine/template';

const result = validateContent(join(import.meta.dirname, '..', '..', 'content'), { runCode: false });
const lessons = Object.values(result.subjects).flatMap((s) => Object.values(s.lessons));

/**
 * "Show solution" renders `solutionState`, which (for the circuit builder) is an automatic grid
 * layout of the netlist. The validator proves the netlist passes; this proves the *displayed*
 * state passes too, for every lesson, variant and parameter set.
 */
describe('challenge solutions as displayed', () => {
  for (const lesson of lessons) {
    it(`${lesson.id} (${lesson.challenge.type})`, () => {
      const ch = lesson.challenge;
      const logic = challengeLogic[ch.type];
      expect(logic).toBeDefined();
      const scopes = ch.params
        ? enumerateParamValues(ch.params, 20).map((v) => applyDerived(v, ch.derived))
        : enumerateParamValues(lesson.params, 20).map((v) =>
            applyDerived(applyDerived(v, lesson.derived), ch.derived),
          );
      for (const vk of ['easier', 'standard', 'harder'] as const) {
        const v = ch.variants[vk];
        for (const scope of scopes) {
          const config = logic.resolveConfig(
            logic.configSchema.parse(v.config),
            makeResolveCtx(scope, evalNumber, renderTemplate),
          );
          const state = logic.solutionState(logic.solutionSchema.parse(v.solution), config);
          expect(
            (state as { netlist?: unknown }).netlist,
            `${vk}: layout fell back to a netlist`,
          ).toBeUndefined();
          const full = { ...scope, ...logic.checkScope(state, config) };
          expect(evalBoolean(v.check.expr, full), `${vk} with ${JSON.stringify(scope)}`).toBe(true);
          expect(logic.builtInFeedback?.(state, config) ?? null).toBeNull();
        }
      }
    });
  }
});
