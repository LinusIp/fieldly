import { useId } from 'react';
import { formatNumber } from '../../engine/format';
import { ticks } from '../plot';
import type { ChallengeComponentProps } from '../types';
import { checkScope, effectiveN, fnOf, RULE_NAMES, type Config, type Rule, type State } from './logic';

const W = 640;
const H = 320;
const M = { l: 44, r: 12, t: 12, b: 32 };

export function RiemannSum({
  config,
  state,
  disabled,
  onStateChange,
}: ChallengeComponentProps<Config, State>) {
  const id = useId();
  const f = fnOf(config);
  const pad = (config.b - config.a) * 0.08;
  const [x0, x1] = [config.a - pad, config.b + pad];
  const [y0, y1] = config.y;
  const sx = (x: number) => M.l + ((x - x0) / (x1 - x0)) * (W - M.l - M.r);
  const sy = (y: number) => H - M.b - ((Math.min(y1, Math.max(y0, y)) - y0) / (y1 - y0)) * (H - M.t - M.b);
  const s = checkScope(state, config);
  const n = s.n as number;
  const h = (config.b - config.a) / n;

  const shapes: string[] = [];
  for (let i = 0; i < n; i++) {
    const l = config.a + i * h;
    const r = l + h;
    if (state.rule === 'trapezoid') {
      shapes.push(`M${sx(l)},${sy(0)}L${sx(l)},${sy(f(l))}L${sx(r)},${sy(f(r))}L${sx(r)},${sy(0)}Z`);
    } else if (state.rule === 'simpson') {
      if (i % 2) continue;
      // The parabola through the three points of this pair of subintervals.
      const [p, q, t] = [l, l + h, l + 2 * h];
      const [fp, fq, ft] = [f(p), f(q), f(t)];
      let d = `M${sx(p)},${sy(0)}`;
      for (let k = 0; k <= 24; k++) {
        const x = p + ((t - p) * k) / 24;
        const y =
          (fp * (x - q) * (x - t)) / ((p - q) * (p - t)) +
          (fq * (x - p) * (x - t)) / ((q - p) * (q - t)) +
          (ft * (x - p) * (x - q)) / ((t - p) * (t - q));
        d += `L${sx(x).toFixed(1)},${sy(y).toFixed(1)}`;
      }
      shapes.push(`${d}L${sx(t)},${sy(0)}Z`);
    } else {
      const xs = state.rule === 'left' ? l : state.rule === 'right' ? r : (l + r) / 2;
      const y = f(xs);
      shapes.push(`M${sx(l)},${sy(0)}L${sx(l)},${sy(y)}L${sx(r)},${sy(y)}L${sx(r)},${sy(0)}Z`);
    }
  }
  const curve = Array.from({ length: 321 }, (_, i) => {
    const x = x0 + ((x1 - x0) * i) / 320;
    return `${i ? 'L' : 'M'}${sx(x).toFixed(1)},${sy(f(x)).toFixed(1)}`;
  }).join('');
  const minN = state.rule === 'simpson' ? 2 : 1;

  return (
    <div className="space-y-4">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Riemann sum"
        data-testid="riemann-plot"
      >
        <rect x={0} y={0} width={W} height={H} fill="var(--c-bg)" rx={10} />
        {ticks(x0, x1).map((t) => (
          <text
            key={`x${t}`}
            x={sx(t)}
            y={H - M.b + 16}
            textAnchor="middle"
            fontSize={11}
            fill="var(--c-muted)"
          >
            {formatNumber(t)}
          </text>
        ))}
        {ticks(y0, y1).map((t) => (
          <g key={`y${t}`}>
            <line x1={M.l} y1={sy(t)} x2={W - M.r} y2={sy(t)} stroke="var(--c-border)" opacity={0.5} />
            <text x={M.l - 6} y={sy(t) + 4} textAnchor="end" fontSize={11} fill="var(--c-muted)">
              {formatNumber(t)}
            </text>
          </g>
        ))}
        {y0 <= 0 && y1 >= 0 && <line x1={M.l} y1={sy(0)} x2={W - M.r} y2={sy(0)} stroke="var(--c-muted)" />}
        {shapes.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="var(--c-accent)"
            fillOpacity={0.22}
            stroke="var(--c-accent)"
            strokeWidth={n > 60 ? 0.5 : 1.2}
          />
        ))}
        <path d={curve} fill="none" stroke="var(--c-text)" strokeWidth={2.5} />
        {[config.a, config.b].map((x) => (
          <line
            key={x}
            x1={sx(x)}
            y1={M.t}
            x2={sx(x)}
            y2={H - M.b}
            stroke="var(--c-muted)"
            strokeDasharray="4 4"
          />
        ))}
      </svg>

      <fieldset className="flex flex-wrap gap-2" disabled={disabled}>
        <legend className="mb-1 text-sm font-medium">Rule</legend>
        {config.rules.map((r: Rule) => (
          <label
            key={r}
            className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm ${state.rule === r ? 'border-[var(--c-accent)] bg-[var(--c-surface)] font-medium' : 'border-[var(--c-border)]'}`}
          >
            <input
              type="radio"
              name={`${id}-rule`}
              value={r}
              checked={state.rule === r}
              onChange={() => onStateChange({ rule: r, n: effectiveN(state.n, r) })}
              className="sr-only"
              data-rule={r}
            />
            {RULE_NAMES[r]}
          </label>
        ))}
      </fieldset>

      <label className="flex flex-col gap-1 text-sm" htmlFor={`${id}-n`}>
        <span className="flex justify-between">
          <span className="font-medium">Subintervals n</span>
          <span className="font-mono">{n}</span>
        </span>
        <input
          id={`${id}-n`}
          type="range"
          min={minN}
          max={config.nMax}
          step={state.rule === 'simpson' ? 2 : 1}
          value={n}
          disabled={disabled}
          onChange={(e) => onStateChange({ ...state, n: effectiveN(Number(e.target.value), state.rule) })}
          className="accent-[var(--c-accent)]"
          data-slider="n"
          aria-label="Subintervals n"
        />
      </label>
      <p className="font-mono text-sm" data-testid="riemann-readouts">
        approximation {formatNumber(s.approx as number, { sig: 6 })} · exact{' '}
        {formatNumber(config.exact, { sig: 6 })} · error {formatNumber(s.error as number)}
      </p>
    </div>
  );
}
