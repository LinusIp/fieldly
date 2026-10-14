import { describe, expect, it } from 'vitest';
import {
  applySolution,
  builtInFeedback,
  checkScope,
  initialState,
  layoutNetlist,
  parseBuildNetlist,
  resolveConfig,
  solutionScope,
  solutionState,
  toNetlist,
  type Config,
  type RawConfig,
} from '../../src/interactives/circuit-builder/model';
import { solveCircuit, type Netlist, type NetElement } from '../../src/interactives/circuit-builder/solver';
import { makeResolveCtx } from '../../src/interactives/types';
import { evalNumber } from '../../src/engine/expr';
import { renderTemplate } from '../../src/engine/template';

const R = (label: string, a: string, b: string, r: number): NetElement => ({
  label,
  kind: 'resistor',
  a,
  b,
  resistance: r,
});
const W = (label: string, a: string, b: string): NetElement => ({ label, kind: 'wire', a, b });
const B = (label: string, a: string, b: string, v: number, r = 0): NetElement => ({
  label,
  kind: 'battery',
  a,
  b,
  voltage: v,
  internalResistance: r,
});
const net = (V: number, elements: NetElement[], rInt = 0): Netlist => ({
  elements: [B('B1', 'p', '0', V, rInt), ...elements],
});

describe('MNA solver — known circuits (§13.1)', () => {
  it('single resistor', () => {
    const r = solveCircuit(net(6, [R('R1', 'p', '0', 3)]));
    expect(r.I).toBeCloseTo(2);
    expect(r.Req).toBeCloseTo(3);
    expect(r.Ptot).toBeCloseTo(12);
    expect(r.elements.R1.V).toBeCloseTo(6);
    expect(r.elements.B1.V).toBe(6);
    expect(r.n).toBe(1);
  });
  it('series and parallel', () => {
    const s = solveCircuit(net(12, [R('R1', 'p', 'a', 4), R('R2', 'a', '0', 8)]));
    expect(s.I).toBeCloseTo(1);
    expect(s.elements.R2.V).toBeCloseTo(8);
    const p = solveCircuit(net(12, [R('R1', 'p', '0', 6), R('R2', 'p', '0', 3)]));
    expect(p.I).toBeCloseTo(6);
    expect(p.Req).toBeCloseTo(2);
    expect(p.elements.R2.I).toBeCloseTo(4);
  });
  it('mixed: R + (R ∥ R)', () => {
    const r = solveCircuit(net(6, [R('R1', 'p', 'a', 4), R('R2', 'a', '0', 4), R('R3', 'a', '0', 4)]));
    expect(r.Req).toBeCloseTo(6);
    expect(r.I).toBeCloseTo(1);
  });
  it('balanced and unbalanced Wheatstone bridge', () => {
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
  it('internal resistance', () => {
    const r = solveCircuit(net(12, [R('R1', 'p', '0', 5)], 1));
    expect(r.I).toBeCloseTo(2);
    expect(r.elements.B1.V).toBeCloseTo(10);
    expect(r.Ptot).toBeCloseTo(24);
  });
  it('two-source Kirchhoff case', () => {
    // B1 = 12 V and B2 = 6 V, each through 2 Ω to a shared 4 Ω load.
    // Node voltage: (12/2 + 6/2) / (1/2 + 1/2 + 1/4) = 7.2 V.
    const r = solveCircuit({
      elements: [
        B('B1', 'p', '0', 12),
        R('R1', 'p', 'x', 2),
        B('B2', 'q', '0', 6),
        R('R2', 'q', 'x', 2),
        R('R3', 'x', '0', 4),
      ],
    });
    expect(r.elements.R3.V).toBeCloseTo(7.2);
    expect(r.elements.R1.I).toBeCloseTo(2.4);
    expect(r.elements.R2.Is).toBeCloseTo(-0.6); // 0.6 A flows from x back into q
    expect(r.elements.B2.I).toBeCloseTo(0.6);
    expect(r.I).toBeCloseTo(2.4);
  });
  it('meters, signed readings and non-ideal meters', () => {
    const r = solveCircuit(
      net(12, [
        { label: 'A1', kind: 'ammeter', a: 'p', b: 'a' },
        R('R1', 'a', 'b', 2),
        R('R2', 'b', '0', 4),
        { label: 'M1', kind: 'voltmeter', a: 'b', b: '0' },
      ]),
    );
    expect(r.elements.A1.I).toBeCloseTo(2);
    expect(r.elements.A1.Is).toBeCloseTo(2);
    expect(r.elements.M1.V).toBeCloseTo(8);
    expect(r.elements.M1.Vs).toBeCloseTo(8);
    const flipped = solveCircuit(
      net(12, [
        R('R1', 'p', 'b', 2),
        R('R2', 'b', '0', 4),
        { label: 'M1', kind: 'voltmeter', a: '0', b: 'b' },
      ]),
    );
    expect(flipped.elements.M1.Vs).toBeCloseTo(-8);
    // A 4 Ω voltmeter across R2 loads the circuit: R2 ∥ 4 = 2 Ω, so I = 3 A.
    const loaded = solveCircuit({
      ...net(12, [
        R('R1', 'p', 'b', 2),
        R('R2', 'b', '0', 4),
        { label: 'M1', kind: 'voltmeter', a: 'b', b: '0' },
      ]),
      meters: { voltmeterResistance: 4 },
    });
    expect(loaded.I).toBeCloseTo(3);
    expect(loaded.elements.M1.V).toBeCloseTo(6);
  });
  it('switches: open breaks the loop, closed conducts', () => {
    expect(
      solveCircuit(
        net(6, [R('R1', 'p', 'a', 3), { label: 'S1', kind: 'switch', a: 'a', b: '0', closed: false }]),
      ).isOpen,
    ).toBe(true);
    expect(
      solveCircuit(
        net(6, [R('R1', 'p', 'a', 3), { label: 'S1', kind: 'switch', a: 'a', b: '0', closed: true }]),
      ).I,
    ).toBeCloseTo(2);
  });
  it('detects shorts and open circuits', () => {
    expect(solveCircuit(net(6, [R('R1', 'p', '0', 3), W('W1', 'p', '0')])).isShort).toBe(true);
    expect(solveCircuit(net(12, [{ label: 'A1', kind: 'ammeter', a: 'p', b: '0' }])).isShort).toBe(true);
    const bypass = solveCircuit(net(6, [R('R1', 'p', 'a', 3), R('R2', 'a', '0', 3), W('W1', 'a', '0')]));
    expect(bypass.isShort).toBe(false);
    expect(bypass.I).toBeCloseTo(2);
    expect(bypass.elements.R2.I).toBeCloseTo(0);
    const open = solveCircuit(net(6, [R('R1', 'p', 'a', 3), R('R2', 'b', '0', 3)]));
    expect(open.isOpen).toBe(true);
    expect(open.I).toBe(0);
    // A voltmeter in series breaks the loop and reads the battery voltage.
    const series = solveCircuit(
      net(12, [{ label: 'M1', kind: 'voltmeter', a: 'p', b: 'a' }, R('R1', 'a', '0', 2)]),
    );
    expect(series.isOpen).toBe(true);
    expect(series.elements.M1.V).toBeCloseTo(12, 4);
    // Capacitors are open in DC.
    expect(
      solveCircuit(net(6, [{ label: 'C1', kind: 'capacitor', a: 'p', b: '0', capacitance: 1e-6 }])).isOpen,
    ).toBe(true);
  });
});

describe('circuit-builder model', () => {
  const resolve = (raw: RawConfig, scope: Record<string, number>): Config =>
    resolveConfig(raw, makeResolveCtx(scope, evalNumber, renderTemplate));

  describe('build mode', () => {
    const config = resolve(
      {
        battery: { voltage: 'V' },
        palette: [
          { kind: 'resistor', resistance: 'R', count: 3 },
          { kind: 'wire', count: 'unlimited' },
        ],
        grid: { cols: 6, rows: 4 },
      },
      { V: 6, R: 4 },
    );
    it('evaluates reference solutions with palette values', () => {
      const s = solutionScope({ netlist: ['B1 n1 0', 'R1 n1 n2', 'R2 n2 0'] }, config);
      expect(s.I).toBeCloseTo(6 / 8);
      expect(s.n).toBe(2);
      expect(s.R_R1).toBe(4);
      expect(solutionScope({ netlist: ['B1 n1 0', 'R1 n1 0', 'R2 n1 n2', 'R3 n2 0'] }, config).I).toBeCloseTo(
        (1.5 * 6) / 4,
      );
    });
    it('refuses more parts than the palette has', () => {
      expect(() =>
        parseBuildNetlist(['B1 n1 0', 'R1 n1 n2', 'R2 n2 n3', 'R3 n3 n4', 'R4 n4 0'], config),
      ).toThrow(/palette/);
    });
    it('lays solutions out with identical behaviour', () => {
      for (const netlist of [
        ['B1 n1 0', 'R1 n1 n2', 'R2 n2 0'],
        ['B1 n1 0', 'R1 n1 0', 'R2 n1 n2', 'R3 n2 0'],
      ]) {
        expect(layoutNetlist(parseBuildNetlist(netlist, config), config)).not.toBeNull();
        const st = solutionState({ netlist }, config);
        expect(st.netlist).toBeUndefined();
        expect(checkScope(st, config).I).toBeCloseTo(solutionScope({ netlist }, config).I as number);
      }
    });
    it('reports unplaced palette parts as 0 and flags an empty board', () => {
      const s = checkScope(initialState(config), config);
      expect(s.P_R3).toBe(0);
      expect(s.isOpen).toBe(true);
      expect(builtInFeedback(initialState(config), config)).toMatch(/No complete loop/);
      expect(toNetlist(initialState(config), config).elements[0]).toMatchObject({
        label: 'B1',
        a: '0,0',
        b: '0,4',
      });
    });
  });

  describe('preset mode with controls (the reference lesson)', () => {
    const config = resolve(
      {
        locked: true,
        preset: ['B1 n1 0 4', 'A1 n1 n2', 'R1 n2 0 4'],
        controls: [
          { element: 'B1', param: 'voltage', min: 2, max: 12, step: 1 },
          { element: 'R1', param: 'resistance', min: 1, max: 12, step: 1 },
        ],
      },
      {},
    );
    it('starts from the preset values and applies control solutions', () => {
      const s0 = checkScope(initialState(config), config);
      expect(s0.I_A1).toBeCloseTo(1);
      expect(s0.V_B1).toBe(4);
      const st = applySolution(initialState(config), { B1: 6, R1: 3 }, config);
      const s = checkScope(st, config);
      expect(s.I_A1).toBeCloseTo(2);
      expect(s.R_R1).toBe(3);
      expect(s.V_B1).toBe(6);
    });
    it('switch controls expose closed_ and change the circuit', () => {
      const hook = resolve(
        {
          locked: true,
          preset: ['B1 n1 0 V', 'L1 n1 n2 R', 'L2 n2 0 R', 'S1 n2 0'],
          controls: [{ element: 'S1', param: 'closed', initial: 1 }],
        },
        { V: 6, R: 3 },
      );
      const closed = checkScope(initialState(hook), hook);
      expect(closed.closed_S1).toBe(1);
      expect(closed.I).toBeCloseTo(2);
      const opened = checkScope(applySolution(initialState(hook), { S1: 0 }, hook), hook);
      expect(opened.closed_S1).toBe(0);
      expect(opened.I).toBeCloseTo(1);
      expect(opened.P_L1).toBeCloseTo(3);
    });
    it('rejects controls on unknown parts and bad solutions', () => {
      expect(() =>
        resolve(
          { preset: ['B1 n1 0 4', 'R1 n1 0 4'], controls: [{ element: 'R9', param: 'resistance' }] },
          {},
        ),
      ).toThrow(/unknown element/);
      expect(() => applySolution(initialState(config), { R7: 2 }, config)).toThrow(/isn't in the preset/);
    });
  });
});
