import { useMemo, useState } from 'react';
import { formatNumber } from '../../engine/format';
import type { ChallengeComponentProps } from '../types';
import {
  describeElement,
  KIND_NAME,
  nextLabel,
  segKey,
  toNetlist,
  validSegment,
  type Config,
  type GridElement,
  type Point,
  type State,
} from './model';
import { solveCircuit, type ElementKind } from './solver';

const CELL = 72;
const PAD = 40;
// Extra room on the left for the battery's labels.
const PAD_LEFT = 96;

type Tool = { type: 'select' } | { type: 'erase' } | { type: 'place'; palette: number };

const px = (p: Point): [number, number] => [PAD_LEFT + p[0] * CELL, PAD + p[1] * CELL];

function paletteLabel(kind: ElementKind, resistance?: number): string {
  const name = KIND_NAME[kind];
  const cap = name[0].toUpperCase() + name.slice(1);
  return resistance !== undefined ? `${cap} ${formatNumber(resistance)} Ω` : cap;
}

function allSegments(config: Config): [Point, Point][] {
  const out: [Point, Point][] = [];
  for (let x = 0; x <= config.cols; x++)
    for (let y = 0; y <= config.rows; y++) {
      const a: Point = [x, y];
      const r: Point = [x + 1, y];
      const d: Point = [x, y + 1];
      if (validSegment(config, a, r)) out.push([a, r]);
      if (validSegment(config, a, d)) out.push([a, d]);
    }
  return out;
}

export function CircuitBuilder({
  config,
  state,
  disabled,
  onStateChange,
  reducedMotion,
  showingSolution,
}: ChallengeComponentProps<Config, State>) {
  const [tool, setTool] = useState<Tool>({ type: 'place', palette: 0 });
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const result = useMemo(() => solveCircuit(toNetlist(state, config)), [state, config]);
  const occupied = useMemo(() => new Map(state.elements.map((e) => [segKey(e.a, e.b), e])), [state]);
  const segments = useMemo(() => allSegments(config), [config]);
  const maxP = Math.max(
    1e-9,
    ...state.elements.filter((e) => e.kind === 'bulb').map((e) => result.elements[e.label]?.P ?? 0),
  );

  const remaining = (i: number) => {
    const used = state.elements.filter((e) => e.palette === i).length;
    return config.palette[i].count - used;
  };
  const nonWireCount = state.elements.filter((e) => e.kind !== 'wire' && !e.locked).length;

  const place = (palette: number, a: Point, b: Point): string | null => {
    const entry = config.palette[palette];
    if (!entry) return 'Choose a part first.';
    if (!validSegment(config, a, b)) return 'That spot is not on the grid (or is inside the battery).';
    if (occupied.has(segKey(a, b))) return 'Something is already there.';
    if (remaining(palette) <= 0) return `No ${KIND_NAME[entry.kind]}s left.`;
    if (config.maxElements !== undefined && entry.kind !== 'wire' && nonWireCount >= config.maxElements)
      return `You can place at most ${config.maxElements} parts.`;
    const el: GridElement = {
      // One element per segment, so the segment key makes a stable unique id.
      id: `el:${segKey(a, b)}`,
      kind: entry.kind,
      label: nextLabel(state.elements, entry.kind),
      a,
      b,
      resistance: entry.resistance,
      closed: entry.kind === 'switch' ? false : undefined,
      palette,
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

  const toggle = (id: string) =>
    onStateChange({
      ...state,
      elements: state.elements.map((e) =>
        e.id === id && e.kind === 'switch' ? { ...e, closed: !e.closed } : e,
      ),
    });

  const clickElement = (e: GridElement) => {
    if (disabled) return;
    if (tool.type === 'erase') remove(e.id);
    else {
      if (e.kind === 'switch') toggle(e.id);
      setSelected(e.id);
    }
  };

  const clickSegment = (a: Point, b: Point) => {
    if (disabled || tool.type !== 'place') return;
    setMessage(place(tool.palette, a, b) ?? '');
  };

  const W = PAD_LEFT + PAD + config.cols * CELL;
  const H = PAD * 2 + config.rows * CELL;
  const live = result.isShort ? 'Short circuit!' : result.isOpen ? 'No complete loop yet.' : '';

  return (
    <div
      className="space-y-3"
      onKeyDown={(e) => {
        if ((e.key === 'Delete' || e.key === 'Backspace') && selected && !disabled) {
          e.preventDefault();
          remove(selected);
        }
      }}
    >
      {!disabled && (
        <div role="toolbar" aria-label="Circuit tools" className="flex flex-wrap gap-2">
          {config.palette.map((p, i) => {
            const left = remaining(i);
            const active = tool.type === 'place' && tool.palette === i;
            return (
              <button
                key={i}
                type="button"
                aria-pressed={active}
                disabled={left <= 0}
                onClick={() => setTool({ type: 'place', palette: i })}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-40 ${
                  active ? 'border-accent bg-accent-soft text-accent' : 'border-border hover:bg-surface-2'
                }`}
              >
                {paletteLabel(p.kind, p.resistance)}
                <span className="ml-1 text-xs text-muted">{Number.isFinite(left) ? `×${left}` : '∞'}</span>
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={tool.type === 'select'}
            onClick={() => setTool({ type: 'select' })}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
              tool.type === 'select'
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-border hover:bg-surface-2'
            }`}
          >
            Select / switch
          </button>
          <button
            type="button"
            aria-pressed={tool.type === 'erase'}
            onClick={() => setTool({ type: 'erase' })}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
              tool.type === 'erase' ? 'border-bad bg-bad-soft text-bad' : 'border-border hover:bg-surface-2'
            }`}
          >
            Erase
          </button>
          <button
            type="button"
            onClick={() => onStateChange({ ...state, elements: state.elements.filter((e) => e.locked) })}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface-2"
          >
            Clear
          </button>
        </div>
      )}

      <p className="text-xs text-muted sm:hidden">Tip: turn your phone sideways for a bigger board.</p>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-manipulation select-none"
        style={{ maxHeight: 520 }}
        role="img"
        aria-label="Circuit board"
        data-testid="circuit-board"
      >
        <rect x={0} y={0} width={W} height={H} fill="var(--c-bg)" rx={12} />
        {/* grid points */}
        {Array.from({ length: config.cols + 1 }, (_, x) =>
          Array.from({ length: config.rows + 1 }, (_, y) =>
            x === 0 && y > 0 && y < config.rows ? null : (
              <circle key={`${x},${y}`} cx={px([x, y])[0]} cy={px([x, y])[1]} r={3} fill="var(--c-border)" />
            ),
          ),
        )}

        <Battery config={config} />

        {/* empty segments: hit targets */}
        {!disabled &&
          tool.type === 'place' &&
          segments
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
                      stroke="var(--c-accent)"
                      strokeWidth={4}
                      strokeDasharray="6 6"
                      opacity={0.6}
                    />
                  )}
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="transparent"
                    strokeWidth={24}
                    style={{ cursor: 'pointer' }}
                    onClick={() => clickSegment(a, b)}
                    data-seg={k}
                  />
                </g>
              );
            })}

        {state.elements.map((e) => (
          <ElementShape
            key={e.id}
            el={e}
            selected={selected === e.id}
            reading={result.elements[e.label]}
            brightness={e.kind === 'bulb' ? (result.elements[e.label]?.P ?? 0) / maxP : 0}
            flow={!reducedMotion && !result.isShort}
            onClick={() => clickElement(e)}
            interactive={!disabled}
          />
        ))}
      </svg>

      <div aria-live="polite" className="min-h-[1.25rem] text-sm">
        {live && <span className="font-medium text-warn">⚠ {live}</span>}
        {message && <span className="ml-2 text-bad">{message}</span>}
      </div>

      {showingSolution && state.netlist && (
        <div className="rounded-lg bg-surface-2 p-3 text-sm">
          <div className="font-semibold">Solution netlist</div>
          <ul className="mt-1 font-mono text-xs">
            {state.netlist.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      )}

      <ListEditor
        config={config}
        state={state}
        disabled={disabled}
        place={place}
        remove={remove}
        toggle={toggle}
        result={result}
      />
    </div>
  );
}

function Battery({ config }: { config: Config }) {
  const [x, y0] = px([0, 0]);
  const [, y1] = px([0, config.rows]);
  const mid = (y0 + y1) / 2;
  return (
    <g aria-hidden="true">
      <line x1={x} y1={y0} x2={x} y2={mid - 8} stroke="var(--c-text)" strokeWidth={3} />
      <line x1={x} y1={mid + 8} x2={x} y2={y1} stroke="var(--c-text)" strokeWidth={3} />
      <line x1={x - 18} y1={mid - 8} x2={x + 18} y2={mid - 8} stroke="var(--c-text)" strokeWidth={3} />
      <line x1={x - 9} y1={mid + 8} x2={x + 9} y2={mid + 8} stroke="var(--c-text)" strokeWidth={6} />
      <text x={x + 22} y={mid - 14} fontSize={16} fontWeight={700} fill="var(--c-text)">
        +
      </text>
      <text x={x + 22} y={mid + 24} fontSize={16} fontWeight={700} fill="var(--c-text)">
        −
      </text>
      <text x={x - 30} y={mid + 5} fontSize={13} textAnchor="end" fill="var(--c-muted)">
        {formatNumber(config.battery.voltage)} V
      </text>
      {config.battery.internalResistance > 0 && (
        <text x={x - 30} y={mid + 22} fontSize={12} textAnchor="end" fill="var(--c-muted)">
          r = {formatNumber(config.battery.internalResistance)} Ω
        </text>
      )}
      <circle cx={x} cy={y0} r={6} fill="var(--c-accent)" />
      <circle cx={x} cy={y1} r={6} fill="var(--c-text)" />
    </g>
  );
}

function ElementShape({
  el,
  selected,
  reading,
  brightness,
  flow,
  onClick,
  interactive,
}: {
  el: GridElement;
  selected: boolean;
  reading?: { I: number; V: number; P: number; dir: number };
  brightness: number;
  flow: boolean;
  onClick(): void;
  interactive: boolean;
}) {
  const [x1, y1] = px(el.a);
  const [x2, y2] = px(el.b);
  const ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  const vertical = x1 === x2;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const stroke = selected ? 'var(--c-accent)' : 'var(--c-text)';
  const L = CELL;
  const body = (() => {
    switch (el.kind) {
      case 'wire':
        return <line x1={0} y1={0} x2={L} y2={0} stroke={stroke} strokeWidth={3} strokeLinecap="round" />;
      case 'resistor': {
        const zig = [0, 1, 2, 3, 4, 5].map((i) => `${L * 0.28 + i * L * 0.08},${i % 2 ? -9 : 9}`).join(' ');
        return (
          <>
            <line x1={0} y1={0} x2={L * 0.28} y2={0} stroke={stroke} strokeWidth={3} />
            <polyline
              points={`${L * 0.24},0 ${zig} ${L * 0.72},0`}
              fill="none"
              stroke={stroke}
              strokeWidth={2.5}
              strokeLinejoin="round"
            />
            <line x1={L * 0.72} y1={0} x2={L} y2={0} stroke={stroke} strokeWidth={3} />
          </>
        );
      }
      case 'bulb':
        return (
          <>
            <line x1={0} y1={0} x2={L * 0.3} y2={0} stroke={stroke} strokeWidth={3} />
            <circle
              cx={L / 2}
              cy={0}
              r={15}
              fill="var(--c-warn)"
              fillOpacity={0.08 + 0.85 * brightness}
              stroke={stroke}
              strokeWidth={2.5}
            />
            <path
              d={`M${L / 2 - 10},-10 L${L / 2 + 10},10 M${L / 2 - 10},10 L${L / 2 + 10},-10`}
              stroke={stroke}
              strokeWidth={2}
            />
            <line x1={L * 0.7} y1={0} x2={L} y2={0} stroke={stroke} strokeWidth={3} />
          </>
        );
      case 'switch':
        return (
          <>
            <line x1={0} y1={0} x2={L * 0.3} y2={0} stroke={stroke} strokeWidth={3} />
            <circle cx={L * 0.3} cy={0} r={3.5} fill={stroke} />
            <line
              x1={L * 0.3}
              y1={0}
              x2={L * 0.7}
              y2={el.closed ? 0 : -18}
              stroke={stroke}
              strokeWidth={3}
              strokeLinecap="round"
            />
            <circle cx={L * 0.7} cy={0} r={3.5} fill={stroke} />
            <line x1={L * 0.7} y1={0} x2={L} y2={0} stroke={stroke} strokeWidth={3} />
          </>
        );
      case 'ammeter':
      case 'voltmeter':
        return (
          <>
            <line x1={0} y1={0} x2={L * 0.3} y2={0} stroke={stroke} strokeWidth={3} />
            <circle cx={L / 2} cy={0} r={15} fill="var(--c-surface)" stroke={stroke} strokeWidth={2.5} />
            <line x1={L * 0.7} y1={0} x2={L} y2={0} stroke={stroke} strokeWidth={3} />
          </>
        );
    }
  })();

  const letter = el.kind === 'ammeter' ? 'A' : el.kind === 'voltmeter' ? 'V' : null;
  const carries =
    reading && reading.I > 1e-9 && (el.kind === 'resistor' || el.kind === 'bulb' || el.kind === 'ammeter');
  const [fx1, fy1, fx2, fy2] = reading && reading.dir < 0 ? [x2, y2, x1, y1] : [x1, y1, x2, y2];
  // Labels sit beside the element, away from the segment.
  const lx = vertical ? mx + 22 : mx;
  const ly = vertical ? my + 4 : my - 22;
  let readout: string | null = null;
  if (el.kind === 'ammeter' && reading)
    readout = Number.isNaN(reading.I) ? '— A' : `${formatNumber(reading.I)} A`;
  if (el.kind === 'voltmeter' && reading)
    readout = Number.isNaN(reading.V) ? '— V' : `${formatNumber(reading.V)} V`;
  const valueText =
    el.kind === 'resistor' || el.kind === 'bulb'
      ? `${el.label} ${formatNumber(el.resistance ?? 0)} Ω`
      : el.kind === 'wire'
        ? null
        : el.label;

  return (
    <g
      onClick={onClick}
      style={{ cursor: interactive ? 'pointer' : 'default' }}
      data-element={el.label}
      aria-label={describeElement(el)}
    >
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={24} />
      <g transform={`translate(${x1},${y1}) rotate(${ang})`}>{body}</g>
      {letter && (
        <text x={mx} y={my + 5} textAnchor="middle" fontSize={15} fontWeight={700} fill={stroke}>
          {letter}
        </text>
      )}
      {carries && flow && (
        <line
          x1={fx1}
          y1={fy1}
          x2={fx2}
          y2={fy2}
          stroke="var(--c-accent)"
          strokeWidth={2}
          strokeDasharray="3 7"
          className="flow-anim"
          opacity={0.9}
          pointerEvents="none"
        />
      )}
      {valueText && (
        <text x={lx} y={ly} textAnchor={vertical ? 'start' : 'middle'} fontSize={12} fill="var(--c-muted)">
          {valueText}
        </text>
      )}
      {readout && (
        <text
          x={vertical ? mx + 22 : mx}
          y={vertical ? my + 20 : my + 34}
          textAnchor={vertical ? 'start' : 'middle'}
          fontSize={13}
          fontWeight={700}
          fill="var(--c-accent)"
          data-reading={el.label}
        >
          {readout}
        </text>
      )}
    </g>
  );
}

const DIRS: Record<string, [number, number]> = { right: [1, 0], down: [0, 1], left: [-1, 0], up: [0, -1] };

/** Keyboard-friendly alternative: add parts by choosing a start point and a direction. */
function ListEditor({
  config,
  state,
  disabled,
  place,
  remove,
  toggle,
  result,
}: {
  config: Config;
  state: State;
  disabled: boolean;
  place(palette: number, a: Point, b: Point): string | null;
  remove(id: string): void;
  toggle(id: string): void;
  result: ReturnType<typeof solveCircuit>;
}) {
  const [palette, setPalette] = useState(0);
  const [from, setFrom] = useState('0,0');
  const [dir, setDir] = useState('right');
  const [msg, setMsg] = useState('');
  const points: string[] = [];
  for (let y = 0; y <= config.rows; y++)
    for (let x = 0; x <= config.cols; x++)
      if (!(x === 0 && y > 0 && y < config.rows)) points.push(`${x},${y}`);
  const pointName = (k: string) => {
    if (k === '0,0') return 'battery + (column 0, row 0)';
    if (k === `0,${config.rows}`) return `battery − (column 0, row ${config.rows})`;
    const [x, y] = k.split(',');
    return `column ${x}, row ${y}`;
  };
  const add = () => {
    const [x, y] = from.split(',').map(Number);
    const d = DIRS[dir];
    const err = place(palette, [x, y], [x + d[0], y + d[1]]);
    setMsg(err ?? 'Added.');
  };
  return (
    <details className="rounded-lg border border-border px-3 py-2 text-sm">
      <summary className="cursor-pointer font-medium">Edit as a list (keyboard)</summary>
      {!disabled && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Part</span>
            <select
              value={palette}
              onChange={(e) => setPalette(Number(e.target.value))}
              className="rounded border border-border bg-surface px-2 py-1"
            >
              {config.palette.map((p, i) => (
                <option key={i} value={i}>
                  {paletteLabel(p.kind, p.resistance)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">From point</span>
            <select
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded border border-border bg-surface px-2 py-1"
            >
              {points.map((k) => (
                <option key={k} value={k}>
                  {pointName(k)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Direction</span>
            <select
              value={dir}
              onChange={(e) => setDir(e.target.value)}
              className="rounded border border-border bg-surface px-2 py-1"
            >
              {Object.keys(DIRS).map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={add}
            className="rounded-lg bg-accent px-3 py-1.5 font-semibold text-on-accent"
          >
            Add
          </button>
          <span aria-live="polite" className="text-xs text-muted">
            {msg}
          </span>
        </div>
      )}
      <ul className="mt-3 space-y-1">
        {state.elements.length === 0 && <li className="text-muted">Nothing placed yet.</li>}
        {state.elements.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center gap-2">
            <span className="flex-1">
              {describeElement(e)}
              {e.kind === 'ammeter' && ` — reads ${formatNumber(result.elements[e.label]?.I ?? 0)} A`}
              {e.kind === 'voltmeter' && ` — reads ${formatNumber(result.elements[e.label]?.V ?? 0)} V`}
            </span>
            {e.kind === 'switch' && !disabled && (
              <button
                type="button"
                onClick={() => toggle(e.id)}
                className="rounded border border-border px-2 py-0.5 text-xs"
              >
                {e.closed ? 'Open' : 'Close'}
              </button>
            )}
            {!e.locked && !disabled && (
              <button
                type="button"
                onClick={() => remove(e.id)}
                className="rounded border border-border px-2 py-0.5 text-xs text-bad"
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
