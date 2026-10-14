import { useMemo, useState, type ReactNode } from 'react';
import { formatNumber } from '../../engine/format';
import type { InteractiveViewProps } from '../types';
import {
  KIND_NAME,
  meterText,
  layoutNetlist,
  nextLabel,
  pkey,
  toNetlist,
  type Config,
  type GridElement,
  type Point,
  type State,
} from './model';
import { solveCircuit, type ElementKind, type Netlist, type SolveResult } from './solver';

/*
 * circuit-builder view (§9.4) drawn as the Arcade interactive board (§10.5): a dot-grid canvas,
 * idle wires in --wire-idle and wires carrying current in --wire-live with travelling dots, parts in
 * white strokes, things the learner controls in violet, readings as volt badges, targets as pink
 * dashed rings. Under the canvas, the controls bar: sliders and switches (preset circuits) or the
 * parts palette and tools (build mode), and a one-line legend.
 */

const CELL = 120;
const PAD = 46;
/** Room right of the last column for part labels and reading badges (they sit beside vertical parts). */
const PAD_RIGHT = 150;
const PAD_LEFT = 104;
const EPS = 1e-6;
/** A wire's stand-in resistance when computing the current along each wire (display only). */
const WIRE_R = 1e-5;

const px = (p: Point): [number, number] => [PAD_LEFT + p[0] * CELL, PAD + p[1] * CELL];
const segKey = (a: Point, b: Point) => [pkey(a), pkey(b)].sort().join('|');

/** Currents in every element, wires included: the same circuit with each wire as a tiny resistor. */
function displaySolve(net: Netlist): SolveResult {
  const withWires: Netlist = {
    ...net,
    elements: net.elements.map((e) =>
      e.kind === 'wire' ? { ...e, kind: 'resistor' as ElementKind, resistance: WIRE_R } : e,
    ),
  };
  try {
    return solveCircuit(withWires);
  } catch {
    return solveCircuit(net);
  }
}

function valueLabel(e: {
  kind: ElementKind;
  resistance?: number;
  voltage?: number;
  capacitance?: number;
}): string {
  if (e.kind === 'resistor' || e.kind === 'bulb') return `${formatNumber(e.resistance ?? 0)} Ω`;
  if (e.kind === 'battery') return `${formatNumber(e.voltage ?? 0)} V`;
  if (e.kind === 'capacitor') return `${formatNumber((e.capacitance ?? 0) * 1e6)} μF`;
  return '';
}

function Badge({ x, y, text }: { x: number; y: number; text: string }) {
  const w = Math.max(50, text.length * 10 + 18);
  return (
    <g data-reading>
      <rect
        x={x - w / 2}
        y={y - 17}
        width={w}
        height={34}
        rx={10}
        fill="var(--wire-live)"
        stroke="var(--board-text)"
        strokeWidth={2}
      />
      <text x={x} y={y + 6} textAnchor="middle" fontSize={17} fontWeight={800} fill="var(--on-fill)">
        {text}
      </text>
    </g>
  );
}

/** A part drawn along its segment: white (or violet when the learner controls it, volt when live). */
function Part({
  el,
  live,
  controlled,
  brightness,
  reading,
  showReading,
  target,
  selected,
  flow,
  onClick,
  clickable,
}: {
  el: GridElement;
  live: boolean;
  controlled: boolean;
  brightness: number;
  reading?: { I: number; V: number };
  showReading: boolean;
  target: boolean;
  selected: boolean;
  flow: boolean;
  onClick?(): void;
  clickable: boolean;
}) {
  const [x1, y1] = px(el.a);
  const [x2, y2] = px(el.b);
  const vertical = x1 === x2;
  const ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const L = CELL;
  const lead = live ? 'var(--wire-live)' : 'var(--wire-idle)';
  const body = controlled
    ? 'var(--control)'
    : live && (el.kind === 'resistor' || el.kind === 'bulb')
      ? 'var(--wire-live)'
      : 'var(--board-text)';
  const lw = live ? 6 : 5;
  let shape: ReactNode;
  switch (el.kind) {
    case 'wire':
      shape = <line x1={0} y1={0} x2={L} y2={0} stroke={lead} strokeWidth={lw} strokeLinecap="round" />;
      break;
    case 'resistor': {
      const zig = [0, 1, 2, 3, 4, 5].map((i) => `${L * 0.3 + i * L * 0.075},${i % 2 ? -11 : 11}`).join(' ');
      shape = (
        <>
          <line x1={0} y1={0} x2={L * 0.27} y2={0} stroke={lead} strokeWidth={lw} strokeLinecap="round" />
          <polyline
            points={`${L * 0.27},0 ${zig} ${L * 0.73},0`}
            fill="none"
            stroke={body}
            strokeWidth={4}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <line x1={L * 0.73} y1={0} x2={L} y2={0} stroke={lead} strokeWidth={lw} strokeLinecap="round" />
        </>
      );
      break;
    }
    case 'bulb':
      shape = (
        <>
          <line x1={0} y1={0} x2={L * 0.31} y2={0} stroke={lead} strokeWidth={lw} strokeLinecap="round" />
          <circle
            cx={L / 2}
            cy={0}
            r={17}
            fill="var(--wire-live)"
            fillOpacity={0.06 + 0.9 * brightness}
            stroke={body}
            strokeWidth={4}
          />
          <path
            d={`M${L / 2 - 11},-11 L${L / 2 + 11},11 M${L / 2 - 11},11 L${L / 2 + 11},-11`}
            stroke={body}
            strokeWidth={3}
            strokeLinecap="round"
          />
          <line x1={L * 0.69} y1={0} x2={L} y2={0} stroke={lead} strokeWidth={lw} strokeLinecap="round" />
        </>
      );
      break;
    case 'switch': {
      const c = controlled || clickable ? 'var(--control)' : 'var(--board-text)';
      shape = (
        <>
          <line x1={0} y1={0} x2={L * 0.3} y2={0} stroke={lead} strokeWidth={lw} strokeLinecap="round" />
          <line
            x1={L * 0.3}
            y1={0}
            x2={L * 0.7}
            y2={el.closed === false ? -22 : 0}
            stroke={c}
            strokeWidth={7}
            strokeLinecap="round"
          />
          <circle
            cx={L * 0.3}
            cy={0}
            r={7}
            fill="var(--primary)"
            stroke="var(--board-text)"
            strokeWidth={3}
          />
          <circle
            cx={L * 0.7}
            cy={0}
            r={7}
            fill="var(--primary)"
            stroke="var(--board-text)"
            strokeWidth={3}
          />
          <line x1={L * 0.7} y1={0} x2={L} y2={0} stroke={lead} strokeWidth={lw} strokeLinecap="round" />
        </>
      );
      break;
    }
    case 'ammeter':
    case 'voltmeter':
      shape = (
        <>
          <line x1={0} y1={0} x2={L * 0.27} y2={0} stroke={lead} strokeWidth={lw} strokeLinecap="round" />
          <circle cx={L / 2} cy={0} r={21} fill="var(--board)" stroke="var(--board-text)" strokeWidth={4} />
          <line x1={L * 0.73} y1={0} x2={L} y2={0} stroke={lead} strokeWidth={lw} strokeLinecap="round" />
        </>
      );
      break;
    case 'capacitor':
      shape = (
        <>
          <line x1={0} y1={0} x2={L * 0.44} y2={0} stroke={lead} strokeWidth={lw} strokeLinecap="round" />
          <line
            x1={L * 0.44}
            y1={-16}
            x2={L * 0.44}
            y2={16}
            stroke={body}
            strokeWidth={4}
            strokeLinecap="round"
          />
          <line
            x1={L * 0.56}
            y1={-16}
            x2={L * 0.56}
            y2={16}
            stroke={body}
            strokeWidth={4}
            strokeLinecap="round"
          />
          <line x1={L * 0.56} y1={0} x2={L} y2={0} stroke={lead} strokeWidth={lw} strokeLinecap="round" />
        </>
      );
      break;
    default:
      shape = null;
  }
  const letter = el.kind === 'ammeter' ? 'A' : el.kind === 'voltmeter' ? 'V' : null;
  const name =
    el.kind === 'wire'
      ? null
      : el.kind === 'resistor' || el.kind === 'bulb'
        ? `${el.label}: ${valueLabel(el)}`
        : el.label;
  const lx = vertical ? mx + 30 : mx;
  const ly = vertical
    ? my - (showReading && (el.kind === 'ammeter' || el.kind === 'voltmeter') ? 12 : -5)
    : my - 30;
  let readout: string | null = null;
  if (showReading && reading && el.kind === 'ammeter')
    readout = Number.isNaN(reading.I) ? '— A' : `${meterText(reading.I)} A`;
  if (showReading && reading && el.kind === 'voltmeter')
    readout = Number.isNaN(reading.V) ? '— V' : `${meterText(reading.V)} V`;
  const carries = live && flow && el.kind !== 'voltmeter' && el.kind !== 'capacitor';
  return (
    <g
      onClick={clickable ? onClick : undefined}
      style={{ cursor: clickable ? 'pointer' : 'default' }}
      data-element={el.label}
      data-live={live || undefined}
    >
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={30} />
      <g transform={`translate(${x1},${y1}) rotate(${ang})`}>{shape}</g>
      {carries && el.kind === 'wire' && (
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="#ffffff"
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray="2 18"
          className="flow-anim"
          opacity={0.85}
          pointerEvents="none"
        />
      )}
      {letter && (
        <text x={mx} y={my + 7} textAnchor="middle" fontSize={20} fontWeight={800} fill="var(--board-text)">
          {letter}
        </text>
      )}
      {name && (
        <text
          x={lx}
          y={ly}
          textAnchor={vertical ? 'start' : 'middle'}
          fontSize={15}
          fontWeight={700}
          fill={controlled ? 'var(--control)' : 'var(--board-text)'}
        >
          {name}
        </text>
      )}
      {readout && (
        <Badge
          x={vertical ? mx + 30 + Math.max(50, readout.length * 10 + 18) / 2 : mx}
          y={vertical ? my + 18 : my + 42}
          text={readout}
        />
      )}
      {(target || selected) && (
        <circle
          cx={mx}
          cy={my}
          r={32}
          fill="none"
          stroke={target ? 'var(--target-on-board)' : 'var(--control)'}
          strokeWidth={3}
          strokeDasharray={target ? '7 6' : undefined}
          pointerEvents="none"
        />
      )}
    </g>
  );
}

function Battery({ rows, voltage, r, live }: { rows: number; voltage: number; r: number; live: boolean }) {
  const [x, y0] = px([0, 0]);
  const [, y1] = px([0, rows]);
  const mid = (y0 + y1) / 2;
  const lead = live ? 'var(--wire-live)' : 'var(--wire-idle)';
  return (
    <g data-element="B1">
      <line
        x1={x}
        y1={y0}
        x2={x}
        y2={mid - 10}
        stroke={lead}
        strokeWidth={live ? 6 : 5}
        strokeLinecap="round"
      />
      <line
        x1={x}
        y1={mid + 10}
        x2={x}
        y2={y1}
        stroke={lead}
        strokeWidth={live ? 6 : 5}
        strokeLinecap="round"
      />
      <line
        x1={x - 24}
        y1={mid - 10}
        x2={x + 24}
        y2={mid - 10}
        stroke="var(--board-text)"
        strokeWidth={5}
        strokeLinecap="round"
      />
      <line
        x1={x - 13}
        y1={mid + 10}
        x2={x + 13}
        y2={mid + 10}
        stroke="var(--board-text)"
        strokeWidth={9}
        strokeLinecap="round"
      />
      <text x={x + 30} y={mid - 16} fontSize={18} fontWeight={800} fill="var(--board-text)">
        +
      </text>
      <text x={x - 40} y={mid + 6} textAnchor="end" fontSize={17} fontWeight={800} fill="var(--board-text)">
        {formatNumber(voltage)} V
      </text>
      {r > 0 && (
        <text
          x={x - 40}
          y={mid + 26}
          textAnchor="end"
          fontSize={14}
          fontWeight={700}
          fill="var(--board-text-2)"
        >
          r = {formatNumber(r)} Ω
        </text>
      )}
    </g>
  );
}

type Tool = { type: 'select' } | { type: 'erase' } | { type: 'place'; palette: number };

function paletteName(kind: ElementKind, value?: number): string {
  const n = KIND_NAME[kind];
  const cap = n[0].toUpperCase() + n.slice(1);
  return value !== undefined ? `${cap} ${formatNumber(value)} Ω` : cap;
}

function validSegment(config: Config, a: Point, b: Point): boolean {
  const inGrid = (p: Point) => p[0] >= 0 && p[0] <= config.cols && p[1] >= 0 && p[1] <= config.rows;
  if (!inGrid(a) || !inGrid(b)) return false;
  if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) !== 1) return false;
  // The battery owns the left edge.
  return !(a[0] === 0 && b[0] === 0);
}

const DIRS: Record<string, [number, number]> = { right: [1, 0], down: [0, 1], left: [-1, 0], up: [0, -1] };

export function CircuitView({
  mode,
  config,
  state,
  disabled,
  onStateChange,
  reducedMotion,
  showingSolution,
  targets,
  onTap,
}: InteractiveViewProps<Config, State>) {
  const [tool, setTool] = useState<Tool>({ type: 'place', palette: 0 });
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [hover, setHover] = useState<string | null>(null);
  const build = config.mode === 'build';

  const net = useMemo(() => toNetlist(state, config), [state, config]);
  const layoutRows = Math.max(config.rows, 2);

  // Preset circuits: lay the fixed parts out once (by structure), then read values from the state.
  const presetLayout = useMemo(() => {
    if (build) return null;
    const n = config.preset.length;
    return layoutNetlist({ elements: config.preset }, { cols: Math.max(config.cols, n), rows: layoutRows });
  }, [build, config, layoutRows]);

  const elements: GridElement[] = useMemo(() => {
    if (build) return state.elements;
    if (!presetLayout) return [];
    const byLabel = new Map(net.elements.map((e) => [e.label, e]));
    return presetLayout.map((g) => {
      const v = byLabel.get(g.label);
      return v ? { ...g, resistance: v.resistance, voltage: v.voltage, closed: v.closed } : g;
    });
  }, [build, state.elements, presetLayout, net]);

  // Solve the circuit as drawn (grid points as nodes, wires included) so every wire knows its current.
  const result = useMemo(() => {
    if (build || !presetLayout) return displaySolve(net);
    const b = net.elements.find((e) => e.label === 'B1');
    const drawn: Netlist = {
      meters: net.meters,
      elements: [
        ...(b ? [{ ...b, a: '0,0', b: `0,${layoutRows}` }] : []),
        ...elements.map((e) => ({
          label: e.label,
          kind: e.kind,
          a: pkey(e.a),
          b: pkey(e.b),
          resistance: e.resistance,
          capacitance: e.capacitance,
          voltage: e.voltage,
          closed: e.closed,
        })),
      ],
    };
    return displaySolve(drawn);
  }, [build, presetLayout, net, elements, layoutRows]);

  const cols = Math.max(build ? config.cols : 1, ...elements.flatMap((e) => [e.a[0], e.b[0]]), 1);
  const rows = build ? config.rows : Math.max(2, ...elements.flatMap((e) => [e.a[1], e.b[1]]));
  const b1 = net.elements.find((e) => e.label === 'B1');
  const b1Live = !!result.elements.B1 && result.elements.B1.I > EPS;
  // "Live" means a real share of the current: the display-only wire resistances leak a trickle
  // (microamps) through parts that a closed switch shorts out.
  const liveFloor = Math.max(
    EPS,
    1e-3 * Math.max(...Object.values(result.elements).map((x) => (Number.isFinite(x.I) ? x.I : 0)), 0),
  );
  const controlled = new Set(config.controls.map((c) => c.element));
  // Brightness against the power the bulb would get alone across all the batteries, so two bulbs in
  // series really look dimmer than one (§9.4).
  const vTotal = net.elements.filter((e) => e.kind === 'battery').reduce((t, e) => t + (e.voltage ?? 0), 0);
  const occupied = new Map(elements.map((e) => [segKey(e.a, e.b), e]));
  const interactive = !disabled && mode !== 'view';
  const flow = !reducedMotion && !result.isShort;

  const remaining = (i: number) => {
    const p = config.palette[i];
    const used = state.elements.filter(
      (e) =>
        e.kind === p.kind && e.resistance === p.resistance && e.capacitance === p.capacitance && !e.locked,
    ).length;
    return p.count - used;
  };

  const place = (i: number, a: Point, b: Point): string | null => {
    const entry = config.palette[i];
    if (!entry) return 'Choose a part first.';
    if (!validSegment(config, a, b)) return 'That spot isn’t on the board.';
    if (occupied.has(segKey(a, b))) return 'Something is already there.';
    if (remaining(i) <= 0) return `No ${KIND_NAME[entry.kind]}s left.`;
    const label = nextLabel(state.elements.concat({ label: 'B1' } as GridElement), entry.kind);
    const el: GridElement = {
      id: `el:${segKey(a, b)}`,
      kind: entry.kind,
      label,
      a,
      b,
      resistance: entry.resistance,
      capacitance: entry.capacitance,
      closed: entry.kind === 'switch' ? true : undefined,
    };
    onStateChange({ ...state, elements: [...state.elements, el] });
    return null;
  };
  const placeWire = (a: Point, b: Point): string | null => {
    if (!validSegment(config, a, b)) return 'That spot isn’t on the board.';
    if (occupied.has(segKey(a, b))) return 'Something is already there.';
    const el: GridElement = {
      id: `el:${segKey(a, b)}`,
      kind: 'wire',
      label: nextLabel(state.elements, 'wire'),
      a,
      b,
    };
    onStateChange({ ...state, elements: [...state.elements, el] });
    return null;
  };
  const remove = (id: string) => {
    const el = state.elements.find((e) => e.id === id);
    if (!el || el.locked) return;
    onStateChange({ ...state, elements: state.elements.filter((e) => e.id !== id) });
    if (selected === id) setSelected(null);
  };
  const toggleSwitch = (label: string) => {
    if (build)
      onStateChange({
        ...state,
        elements: state.elements.map((e) =>
          e.label === label && e.kind === 'switch' ? { ...e, closed: !e.closed } : e,
        ),
      });
    else if (controlled.has(label)) {
      const cur = state.values[label] ?? config.controls.find((c) => c.element === label)?.initial ?? 1;
      onStateChange({ ...state, values: { ...state.values, [label]: cur >= 0.5 ? 0 : 1 } });
    }
  };

  // Wire tool: in build mode, the "place" tool with palette index -1 lays wires.
  const [wireTool, setWireTool] = useState(build && config.palette.length === 0);
  const clickSegment = (a: Point, b: Point) => {
    if (!interactive || !build) return;
    if (wireTool) setMessage(placeWire(a, b) ?? '');
    else if (tool.type === 'place') setMessage(place(tool.palette, a, b) ?? '');
  };
  const clickPart = (e: GridElement) => {
    if (mode === 'view' && targets?.includes(e.label)) {
      onTap?.(e.label);
      return;
    }
    if (!interactive) return;
    if (build && tool.type === 'erase' && !wireTool) return remove(e.id);
    if (e.kind === 'switch') toggleSwitch(e.label);
    if (build) setSelected(e.id);
  };

  const segments: [Point, Point][] = [];
  if (build && interactive)
    for (let x = 0; x <= config.cols; x++)
      for (let y = 0; y <= config.rows; y++) {
        const a: Point = [x, y];
        for (const b of [
          [x + 1, y],
          [x, y + 1],
        ] as Point[])
          if (validSegment(config, a, b)) segments.push([a, b]);
      }

  const W = PAD_LEFT + PAD_RIGHT + cols * CELL;
  const H = PAD * 2 + rows * CELL + 10;
  const live = result.isShort
    ? 'Short circuit! A wire joins the battery’s terminals.'
    : result.isOpen
      ? 'No complete loop yet, so no current flows.'
      : '';
  const legend = build
    ? 'Yellow wires carry current. Pick a part, then tap a gap between two dots.'
    : controlled.size
      ? `Yellow wires carry current. ${[...controlled].some((l) => l.startsWith('S')) ? 'Tap the switch to try it.' : 'Drag the sliders to try it.'}`
      : 'Yellow wires carry current.';

  return (
    <div
      onKeyDown={(e) => {
        if ((e.key === 'Delete' || e.key === 'Backspace') && selected && interactive) {
          e.preventDefault();
          remove(selected);
        }
      }}
    >
      <div className="board-canvas flex justify-center px-3 pt-5 pb-2">
        {!build && !presetLayout ? (
          <p className="p-6 font-semibold text-board-text" data-testid="circuit-board">
            This circuit is too large to draw here. Its parts and connections are described below.
          </p>
        ) : (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full touch-manipulation select-none"
            style={{ maxWidth: Math.min(880, W), maxHeight: 480 }}
            role="img"
            aria-label="Circuit board"
            data-testid="circuit-board"
          >
            <g fill="none" strokeLinecap="round" strokeLinejoin="round">
              {b1 && (
                <Battery rows={rows} voltage={b1.voltage ?? 0} r={b1.internalResistance ?? 0} live={b1Live} />
              )}
            </g>
            {/* Snap points in build mode: where parts can start and end. */}
            {build &&
              interactive &&
              Array.from({ length: config.cols + 1 }, (_, x) =>
                Array.from({ length: config.rows + 1 }, (_, y) => {
                  if (x === 0 && y > 0 && y < config.rows) return null;
                  const [cx, cy] = px([x, y]);
                  return (
                    <circle
                      key={`p${x},${y}`}
                      cx={cx}
                      cy={cy}
                      r={5}
                      fill="var(--board-text-2)"
                      opacity={0.55}
                      pointerEvents="none"
                    />
                  );
                }),
              )}
            {/* Joints where three or more ends meet. */}
            {(() => {
              const count = new Map<string, number>();
              for (const e of elements)
                for (const p of [e.a, e.b]) count.set(pkey(p), (count.get(pkey(p)) ?? 0) + 1);
              if (b1)
                for (const p of [
                  [0, 0],
                  [0, rows],
                ] as Point[])
                  count.set(pkey(p), (count.get(pkey(p)) ?? 0) + 1);
              return [...count]
                .filter(([, n]) => n >= 3)
                .map(([k]) => {
                  const [x, y] = k.split(',').map(Number);
                  const [cx, cy] = px([x, y]);
                  return (
                    <circle key={k} cx={cx} cy={cy} r={7} fill="var(--wire-live)" pointerEvents="none" />
                  );
                });
            })()}
            {segments
              .filter(([a, b]) => !occupied.has(segKey(a, b)))
              .map(([a, b]) => {
                const k = segKey(a, b);
                const [x1, y1] = px(a);
                const [x2, y2] = px(b);
                return (
                  <g key={k} onPointerEnter={() => setHover(k)} onPointerLeave={() => setHover(null)}>
                    {hover === k && (
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="var(--control)"
                        strokeWidth={5}
                        strokeDasharray="6 7"
                        strokeLinecap="round"
                      />
                    )}
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="transparent"
                      strokeWidth={26}
                      style={{ cursor: 'pointer' }}
                      onClick={() => clickSegment(a, b)}
                      data-seg={k}
                    />
                  </g>
                );
              })}
            {elements.map((e) => {
              const r = result.elements[e.label];
              return (
                <Part
                  key={e.id}
                  el={e}
                  live={!!r && r.I > liveFloor && !Number.isNaN(r.I)}
                  controlled={controlled.has(e.label) || (build && !e.locked && e.kind === 'switch')}
                  brightness={
                    e.kind === 'bulb'
                      ? Math.min(1, (r?.P ?? 0) / Math.max(EPS, (vTotal * vTotal) / (e.resistance ?? 1)))
                      : 0
                  }
                  reading={r}
                  showReading={!config.hideReadings}
                  target={!!targets?.includes(e.label)}
                  selected={selected === e.id}
                  flow={flow}
                  clickable={
                    (mode === 'view' && !!targets?.includes(e.label)) ||
                    (interactive && (build || e.kind === 'switch'))
                  }
                  onClick={() => clickPart(e)}
                />
              );
            })}
          </svg>
        )}
      </div>

      {showingSolution && state.netlist && (
        <div className="bg-board px-4 pb-3 text-small font-semibold text-board-text-2">
          Solution: {state.netlist.join('; ')}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 bg-board-bar px-4 py-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          {!build &&
            config.controls.map((c) => {
              const value = state.values[c.element] ?? c.initial;
              if (c.param === 'closed')
                return (
                  <button
                    key={c.element}
                    type="button"
                    aria-pressed={value >= 0.5}
                    disabled={!interactive}
                    onClick={() => toggleSwitch(c.element)}
                    className="inline-flex min-h-[48px] items-center gap-3 rounded-full border-2 border-board-text bg-primary py-0 pr-4 pl-2 font-extrabold text-on-primary disabled:opacity-60"
                    data-control={c.element}
                  >
                    <span
                      className={`flex h-7 w-12 items-center rounded-full border-2 border-outline p-0.5 ${value >= 0.5 ? 'justify-end bg-volt' : 'justify-start bg-surface-tint'}`}
                    >
                      <span className="h-5 w-5 rounded-full bg-ink" />
                    </span>
                    Switch {c.element} is {value >= 0.5 ? 'closed' : 'open'}
                  </button>
                );
              const unit = c.param === 'voltage' ? 'V' : 'Ω';
              return (
                <label
                  key={c.element}
                  className="inline-flex min-h-[48px] items-center gap-3 rounded-full border-2 border-board-text bg-primary px-4 font-extrabold text-on-primary"
                >
                  <span className="whitespace-nowrap">
                    {c.element} {formatNumber(value)} {unit}
                  </span>
                  <input
                    type="range"
                    min={c.min}
                    max={c.max}
                    step={c.step}
                    value={value}
                    disabled={!interactive}
                    aria-label={`${c.element} ${c.param === 'voltage' ? 'voltage' : 'resistance'} in ${c.param === 'voltage' ? 'volts' : 'ohms'}`}
                    onChange={(e) =>
                      onStateChange({
                        ...state,
                        values: { ...state.values, [c.element]: Number(e.target.value) },
                      })
                    }
                    className="w-32 accent-[var(--volt)]"
                    data-control={c.element}
                  />
                </label>
              );
            })}
          {build && interactive && (
            <div role="toolbar" aria-label="Parts and tools" className="flex flex-wrap gap-2">
              {config.palette.map((p, i) => {
                const left = remaining(i);
                const active = !wireTool && tool.type === 'place' && tool.palette === i;
                return (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={active}
                    disabled={left <= 0}
                    onClick={() => {
                      setWireTool(false);
                      setTool({ type: 'place', palette: i });
                    }}
                    className={`min-h-[44px] rounded-full border-2 px-3.5 text-small font-extrabold disabled:opacity-40 ${active ? 'border-board-text bg-primary text-on-primary' : 'border-board-text-2 bg-board text-board-text'}`}
                  >
                    {paletteName(p.kind, p.resistance)}{' '}
                    <span className="tabular opacity-80">{Number.isFinite(left) ? `×${left}` : '∞'}</span>
                  </button>
                );
              })}
              {(
                [
                  ['Wire', wireTool, () => setWireTool(true)],
                  [
                    'Select / switch',
                    !wireTool && tool.type === 'select',
                    () => (setWireTool(false), setTool({ type: 'select' })),
                  ],
                  [
                    'Erase',
                    !wireTool && tool.type === 'erase',
                    () => (setWireTool(false), setTool({ type: 'erase' })),
                  ],
                ] as const
              ).map(([label, on, act]) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={on}
                  onClick={act}
                  className={`min-h-[44px] rounded-full border-2 px-3.5 text-small font-extrabold ${on ? 'border-board-text bg-primary text-on-primary' : 'border-board-text-2 bg-board text-board-text'}`}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => onStateChange({ ...state, elements: state.elements.filter((e) => e.locked) })}
                className="min-h-[44px] rounded-full border-2 border-board-text-2 bg-board px-3.5 text-small font-extrabold text-board-text"
              >
                Clear
              </button>
            </div>
          )}
        </div>
        <span className="text-small font-semibold text-board-text-2">{legend}</span>
      </div>

      <div
        aria-live="polite"
        className="bg-board-bar px-4 pb-3 text-small font-extrabold text-volt empty:hidden"
      >
        {live || message ? `${live} ${message}`.trim() : ''}
      </div>

      {build && interactive && (
        <ListEditor
          config={config}
          state={state}
          place={(i, a, b) => (i < 0 ? placeWire(a, b) : place(i, a, b))}
          remove={remove}
          toggle={toggleSwitch}
          result={result}
        />
      )}
    </div>
  );
}

/** Keyboard-friendly editor (§11): add a part from a point in a direction; list, switch and remove parts. */
function ListEditor({
  config,
  state,
  place,
  remove,
  toggle,
  result,
}: {
  config: Config;
  state: State;
  place(palette: number, a: Point, b: Point): string | null;
  remove(id: string): void;
  toggle(label: string): void;
  result: SolveResult;
}) {
  const [palette, setPalette] = useState(-1);
  const [from, setFrom] = useState('0,0');
  const [dir, setDir] = useState('right');
  const [msg, setMsg] = useState('');
  const points: string[] = [];
  for (let y = 0; y <= config.rows; y++) for (let x = 0; x <= config.cols; x++) points.push(`${x},${y}`);
  const pointName = (k: string) => {
    if (k === '0,0') return 'battery + (column 0, row 0)';
    if (k === `0,${config.rows}`) return `battery − (column 0, row ${config.rows})`;
    const [x, y] = k.split(',');
    return `column ${x}, row ${y}`;
  };
  const select = 'min-h-[44px] rounded-md border-2 border-board-text-2 bg-board px-2 text-board-text';
  return (
    <details className="bg-board-bar px-4 pb-4 text-small text-board-text">
      <summary className="flex min-h-[44px] cursor-pointer items-center font-extrabold">
        Edit as a list (keyboard)
      </summary>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="font-semibold text-board-text-2">Part</span>
          <select value={palette} onChange={(e) => setPalette(Number(e.target.value))} className={select}>
            <option value={-1}>Wire</option>
            {config.palette.map((p, i) => (
              <option key={i} value={i}>
                {paletteName(p.kind, p.resistance)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold text-board-text-2">From point</span>
          <select value={from} onChange={(e) => setFrom(e.target.value)} className={select}>
            {points.map((k) => (
              <option key={k} value={k}>
                {pointName(k)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold text-board-text-2">Direction</span>
          <select value={dir} onChange={(e) => setDir(e.target.value)} className={select}>
            {Object.keys(DIRS).map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            const [x, y] = from.split(',').map(Number);
            const d = DIRS[dir];
            setMsg(place(palette, [x, y], [x + d[0], y + d[1]]) ?? 'Added.');
          }}
          className="min-h-[44px] rounded-md border-2 border-board-text bg-primary px-4 font-extrabold text-on-primary"
        >
          Add
        </button>
        <span aria-live="polite" className="font-semibold text-board-text-2">
          {msg}
        </span>
      </div>
      <ul className="mt-3 flex flex-col gap-1">
        {state.elements.length === 0 && <li className="text-board-text-2">Nothing placed yet.</li>}
        {state.elements
          .filter((e) => e.kind !== 'wire')
          .map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-2">
              <span className="flex-1">
                {KIND_NAME[e.kind]} {e.label}
                {e.resistance !== undefined ? ` (${formatNumber(e.resistance)} Ω)` : ''} from{' '}
                {pointName(pkey(e.a))} to {pointName(pkey(e.b))}
                {e.kind === 'ammeter' && `, reads ${meterText(result.elements[e.label]?.I ?? 0)} A`}
                {e.kind === 'voltmeter' && `, reads ${meterText(result.elements[e.label]?.V ?? 0)} V`}
              </span>
              {e.kind === 'switch' && (
                <button
                  type="button"
                  onClick={() => toggle(e.label)}
                  className="min-h-[44px] rounded-md border-2 border-board-text-2 px-3"
                >
                  {e.closed ? 'Open it' : 'Close it'}
                </button>
              )}
              {!e.locked && (
                <button
                  type="button"
                  onClick={() => remove(e.id)}
                  className="min-h-[44px] rounded-md border-2 border-board-text-2 px-3"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
      </ul>
    </details>
  );
}
