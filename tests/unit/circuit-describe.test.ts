import { describe, expect, it } from 'vitest';
import { evalNumber } from '../../src/engine/expr';
import { renderTemplate } from '../../src/engine/template';
import { circuitLogic, meterText, type RawConfig } from '../../src/interactives/circuit-builder/model';
import { makeResolveCtx } from '../../src/interactives/types';

const resolve = (raw: RawConfig) =>
  circuitLogic.resolveConfig(
    circuitLogic.configSchema.parse(raw),
    makeResolveCtx({}, evalNumber, renderTemplate),
  );

describe('circuit describeState (§11)', () => {
  it('says how the parts connect, with one full stop per sentence', () => {
    const config = resolve({ preset: ['B1 n1 0 12', 'R1 n1 n2 4', 'R2 n2 0 4', 'R3 n2 0 4'] });
    const text = circuitLogic.describeState(circuitLogic.initialState(config), config);
    expect(text).toContain('Across B1: R1 in series with (R2 ∥ R3)');
    expect(text).toContain('Battery current 2 A');
    expect(text).not.toMatch(/\.\./);
    expect(text.length).toBeGreaterThan(20);
  });

  it('reads an idle voltmeter as 0, not solver round-off', () => {
    const config = resolve({
      preset: ['B1 n1 0 12', 'R1 n1 n2 4', 'S1 n2 n3 open', 'R2 n3 0 4', 'M1 n3 0'],
    });
    const text = circuitLogic.describeState(circuitLogic.initialState(config), config);
    expect(text).toContain('M1 reads 0 V');
    expect(text).not.toMatch(/10\^|×\s*10|e-/);
  });

  it('formats readings to three significant figures', () => {
    expect(meterText(7.25e-13)).toBe('0');
    expect(meterText(0.66666)).toBe('0.667');
    expect(meterText(12)).toBe('12');
    expect(meterText(Number.NaN)).toBe('—');
  });
});
