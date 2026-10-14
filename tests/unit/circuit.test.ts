import { describe, expect, it } from 'vitest';
import {
  checkScope,
  layoutNetlist,
  parseNetlist,
  resolveConfig,
  solutionScope,
  solutionState,
  toNetlist,
  type Config,
} from '../../src/interactives/circuit-builder/model';
import { solveCircuit, type Netlist, type NetElement } from '../../src/interactives/circuit-builder/solver';

const R = (label: string, a: string, b: string, r: number): NetElement => ({
  label,
  kind: 'resistor',
  a,
  b,
  resistance: r,
});
const W = (label: string, a: string, b: string): NetElement => ({ label, kind: 'wire', a, b });
const net = (V: number, elements: NetElement[], rInt = 0): Netlist => ({
  battery: { p: 'p', n: '0', voltage: V, internalResistance: rInt },
  elements,
});

describe('MNA solver — known circuits', () => {
  it('single resistor', () => {
    const r = solveCircuit(net(6, [R('R1', 'p', '0', 3)]));
    expect(r.I).toBeCloseTo(2);
    expect(r.Req).toBeCloseTo(3);
    expect(r.Ptot).toBeCloseTo(12);
    expect(r.elements.R1.V).toBeCloseTo(6);
    expect(r.n).toBe(1);
  });
  it('series', () => {
    const r = solveCircuit(net(12, [R('R1', 'p', 'a', 4), R('R2', 'a', '0', 8)]));
    expect(r.I).toBeCloseTo(1);
    expect(r.elements.R1.V).toBeCloseTo(4);
    expect(r.elements.R2.V).toBeCloseTo(8);
  });
  it('parallel', () => {
    const r = solveCircuit(net(12, [R('R1', 'p', '0', 6), R('R2', 'p', '0', 3)]));
    expect(r.I).toBeCloseTo(6);
    expect(r.Req).toBeCloseTo(2);
    expect(r.elements.R1.I).toBeCloseTo(2);
    expect(r.elements.R2.I).toBeCloseTo(4);
  });
  it('mixed: R + (R ∥ R)', () => {
    const r = solveCircuit(net(6, [R('R1', 'p', 'a', 4), R('R2', 'a', '0', 4), R('R3', 'a', '0', 4)]));
    expect(r.Req).toBeCloseTo(6);
    expect(r.I).toBeCloseTo(1);
  });
  it('balanced and unbalanced Wheatstone bridge', () => {
    // Balanced: no current through the bridge resistor.
    const bal = solveCircuit(
      net(10, [
        R('R1', 'p', 'a', 1),
        R('R2', 'a', '0', 2),
        R('R3', 'p', 'b', 1),
        R('R4', 'b', '0', 2),
        R('R5', 'a', 'b', 5),
      ]),
    );
    expect(bal.elements.R5.I).toBeCloseTo(0);
    expect(bal.Req).toBeCloseTo(1.5);
    // Unbalanced bridge (all 1 Ω except R4 = 2 Ω): node voltages 7 V and 8 V, I = 11 A, Req = 13/11 Ω.
    const un = solveCircuit(
      net(13, [
        R('R1', 'p', 'a', 1),
        R('R2', 'a', '0', 1),
        R('R3', 'p', 'b', 1),
        R('R4', 'b', '0', 2),
        R('R5', 'a', 'b', 1),
      ]),
    );
    expect(un.Req).toBeCloseTo(13 / 11);
  });
  it('two-source Kirchhoff case via internal resistance and a second branch', () => {
    // Battery 12 V with 1 Ω internal resistance driving 5 Ω: I = 2 A, terminal 10 V.
    const r = solveCircuit(net(12, [R('R1', 'p', '0', 5)], 1));
    expect(r.I).toBeCloseTo(2);
    expect(r.Req).toBeCloseTo(5);
    expect(r.Ptot).toBeCloseTo(24);
  });
  it('detects a short across the source', () => {
    const r = solveCircuit(net(6, [R('R1', 'p', '0', 3), W('W1', 'p', '0')]));
    expect(r.isShort).toBe(true);
  });
  it('a wire across one resistor is not a short of the source', () => {
    const r = solveCircuit(net(6, [R('R1', 'p', 'a', 3), R('R2', 'a', '0', 3), W('W1', 'a', '0')]));
    expect(r.isShort).toBe(false);
    expect(r.I).toBeCloseTo(2);
    expect(r.elements.R2.I).toBeCloseTo(0);
    expect(r.n).toBe(1);
  });
  it('detects an open circuit', () => {
    const r = solveCircuit(net(6, [R('R1', 'p', 'a', 3), R('R2', 'b', '0', 3)]));
    expect(r.isOpen).toBe(true);
    expect(r.I).toBe(0);
    const sw = solveCircuit(
      net(6, [R('R1', 'p', 'a', 3), { label: 'S1', kind: 'switch', a: 'a', b: '0', closed: false }]),
    );
    expect(sw.isOpen).toBe(true);
    const closed = solveCircuit(
      net(6, [R('R1', 'p', 'a', 3), { label: 'S1', kind: 'switch', a: 'a', b: '0', closed: true }]),
    );
    expect(closed.I).toBeCloseTo(2);
  });
  it('meters: ammeter in series reads the current; voltmeter reads the drop', () => {
    const r = solveCircuit(
      net(12, [
        { label: 'A1', kind: 'ammeter', a: 'p', b: 'a' },
        R('R1', 'a', 'b', 2),
        R('R2', 'b', '0', 4),
        { label: 'V1', kind: 'voltmeter', a: 'b', b: '0' },
      ]),
    );
    expect(r.elements.A1.I).toBeCloseTo(2);
    expect(r.elements.V1.V).toBeCloseTo(8);
    // A voltmeter in series breaks the loop.
    const bad = solveCircuit(
      net(12, [{ label: 'V1', kind: 'voltmeter', a: 'p', b: 'a' }, R('R1', 'a', '0', 2)]),
    );
    expect(bad.isOpen).toBe(true);
    expect(bad.elements.V1.V).toBeCloseTo(12);
    // An ammeter straight across the battery is a short.
    expect(solveCircuit(net(12, [{ label: 'A1', kind: 'ammeter', a: 'p', b: '0' }])).isShort).toBe(true);
  });
});

describe('circuit-builder logic', () => {
  const ctx = (scope: Record<string, number>) => ({
    scope,
    num: (v: number | string) => (typeof v === 'number' ? v : (scope[v] ?? Number(v))),
  });
  const config: Config = resolveConfig(
    {
      battery: { voltage: 'V' },
      palette: [
        { kind: 'resistor', resistance: 'R', count: 3 },
        { kind: 'wire', count: 'unlimited' },
      ],
      grid: { cols: 6, rows: 4 },
    },
    ctx({ V: 6, R: 4 }),
  );

  it('evaluates the reference solutions', () => {
    const s = solutionScope({ netlist: ['B1 n1 0', 'R1 n1 n2', 'R2 n2 0'] }, config);
    expect(s.I).toBeCloseTo(6 / 8);
    expect(s.n).toBe(2);
    const s2 = solutionScope({ netlist: ['B1 n1 0', 'R1 n1 n2', 'R2 n2 0', 'R3 n2 0'] }, config);
    expect(s2.I).toBeCloseTo(6 / 6);
    const s3 = solutionScope({ netlist: ['B1 n1 0', 'R1 n1 0', 'R2 n1 n2', 'R3 n2 0'] }, config);
    expect(s3.I).toBeCloseTo((1.5 * 6) / 4);
    expect(s3.n).toBe(3);
  });

  it('lays solutions out on the grid with identical behaviour', () => {
    for (const netlist of [
      ['B1 n1 0', 'R1 n1 n2', 'R2 n2 0'],
      ['B1 n1 0', 'R1 n1 n2', 'R2 n2 0', 'R3 n2 0'],
      ['B1 n1 0', 'R1 n1 0', 'R2 n1 n2', 'R3 n2 0'],
    ]) {
      const parsed = parseNetlist(netlist, config);
      expect(layoutNetlist(parsed, config)).not.toBeNull();
      const st = solutionState({ netlist }, config);
      expect(st.netlist).toBeUndefined();
      expect(checkScope(st, config).I).toBeCloseTo(solutionScope({ netlist }, config).I as number);
    }
  });

  it('solves grid states', () => {
    const st = {
      elements: [
        {
          id: '1',
          kind: 'wire' as const,
          label: 'W1',
          a: [0, 0] as [number, number],
          b: [1, 0] as [number, number],
        },
        {
          id: '2',
          kind: 'resistor' as const,
          label: 'R1',
          a: [1, 0] as [number, number],
          b: [1, 1] as [number, number],
          resistance: 4,
        },
        {
          id: '3',
          kind: 'wire' as const,
          label: 'W2',
          a: [1, 1] as [number, number],
          b: [1, 2] as [number, number],
        },
        {
          id: '4',
          kind: 'wire' as const,
          label: 'W3',
          a: [1, 2] as [number, number],
          b: [1, 3] as [number, number],
        },
        {
          id: '5',
          kind: 'wire' as const,
          label: 'W4',
          a: [1, 3] as [number, number],
          b: [1, 4] as [number, number],
        },
        {
          id: '6',
          kind: 'wire' as const,
          label: 'W5',
          a: [1, 4] as [number, number],
          b: [0, 4] as [number, number],
        },
      ],
    };
    const s = checkScope(st, config);
    expect(s.I).toBeCloseTo(1.5);
    expect(toNetlist(st, config).battery.n).toBe('0,4');
  });
});
