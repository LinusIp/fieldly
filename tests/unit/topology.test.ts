import { describe, expect, it } from 'vitest';
import { topologyText } from '../../src/interactives/circuit-builder/topology';
import type { NetElement } from '../../src/interactives/circuit-builder/solver';

const el = (line: string): NetElement => {
  const [label, a, b] = line.split(' ');
  const kinds: Record<string, NetElement['kind']> = {
    B: 'battery',
    R: 'resistor',
    L: 'bulb',
    S: 'switch',
    A: 'ammeter',
    M: 'voltmeter',
    W: 'wire',
    C: 'capacitor',
  };
  const kind = kinds[label[0]];
  return { label, kind, a, b, closed: kind === 'switch' ? true : undefined };
};
const net = (...lines: string[]) => ({ elements: lines.map(el) });

describe('circuit topology in words (§11)', () => {
  it('names series and parallel groups', () => {
    expect(topologyText(net('B1 n1 0', 'R1 n1 n2', 'R2 n2 0', 'R3 n2 0'))).toBe(
      'Across B1: R1 in series with (R2 ∥ R3)',
    );
    expect(topologyText(net('B1 n1 0', 'R1 n1 n2', 'R2 n2 0'))).toBe('Across B1: R1 in series with R2');
    expect(topologyText(net('B1 n1 0', 'R1 n1 0', 'R2 n1 0'))).toBe('Across B1: R1 ∥ R2');
  });
  it('merges wires, includes meters and switches, and places voltmeters', () => {
    expect(topologyText(net('B1 n1 0', 'A1 n1 n2', 'W1 n2 n3', 'R1 n3 0', 'M1 n3 0'))).toBe(
      'Across B1: A1 in series with R1. Voltmeter M1 is across R1',
    );
    expect(topologyText(net('B1 n1 0', 'L1 n1 n2', 'L2 n2 0', 'S1 n2 0'))).toBe(
      'Across B1: L1 in series with (L2 ∥ S1 (closed))',
    );
  });
  it('reports shorts, empty boards and bridges', () => {
    expect(topologyText(net('B1 n1 0', 'W1 n1 0'))).toContain('B1 is shorted');
    expect(topologyText(net('B1 n1 0'))).toContain('Nothing is connected');
    const bridge = topologyText(net('B1 a 0', 'R1 a b', 'R2 a c', 'R3 b c', 'R4 b 0', 'R5 c 0'));
    expect(bridge).toContain('R3 joins b to c');
  });
});
