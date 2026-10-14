import { useId } from 'react';
import { formatNumber } from '../../engine/format';
import type { ChallengeComponentProps } from '../types';
import { currentValues, fracAt, isRC, rising, tauOf, UNITS, yAt, type Config, type State } from './logic';

const W = 640;

/** Show capacitances in μF and large resistances in kΩ. */
function friendly(name: string, x: number): string {
  if (name === 'C' && Math.abs(x) < 1e-3) return `${formatNumber(x * 1e6)} μF`;
  if (name === 'R' && Math.abs(x) >= 1000) return `${formatNumber(x / 1000)} kΩ`;
  return `${formatNumber(x)} ${UNITS[name as keyof typeof UNITS]}`;
}
const H = 300;
const M = { l: 56, r: 16, t: 16, b: 40 };

export function TransientPlotter({
  config,
  state,
  disabled,
  onStateChange,
}: ChallengeComponentProps<Config, State>) {
  const id = useId();
  const v = currentValues(state, config);
  const tau = tauOf(v, config.mode);
  const rc = isRC(config.mode);
  const yMaxVal = rc ? v.V : v.V / v.R;
  // Keep the y-axis steady while sliders move: scale to the largest value any slider setting can give.
  let yScale = Math.abs(yMaxVal);
  for (const s of config.sliders) {
    if (s.name === 'V' && rc) yScale = Math.max(yScale, s.max);
    if (!rc && (s.name === 'V' || s.name === 'R')) {
      const vMax = s.name === 'V' ? s.max : v.V;
      const rMin = s.name === 'R' ? s.min : v.R;
      yScale = Math.max(yScale, vMax / rMin);
    }
  }
  yScale = yScale || 1;
  const sx = (t: number) => M.l + (t / config.tMax) * (W - M.l - M.r);
  const sy = (y: number) => H - M.b - (y / yScale) * (H - M.t - M.b);
  const N = 160;
  const path = Array.from({ length: N + 1 }, (_, i) => {
    const t = (i / N) * config.tMax;
    return `${i ? 'L' : 'M'}${sx(t).toFixed(1)},${sy(yAt(t, v, config.mode)).toFixed(1)}`;
  }).join(' ');
  const unit = rc ? 'V' : 'A';
  const what = rc ? 'Capacitor voltage' : 'Current';
  const ref = rising(config.mode) ? 0.632 : 0.368;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * config.tMax);

  return (
    <div className="space-y-4">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`${what} against time`}
        data-testid="transient-plot"
      >
        <rect x={0} y={0} width={W} height={H} fill="var(--c-bg)" rx={10} />
        {/* axes */}
        <line x1={M.l} y1={H - M.b} x2={W - M.r} y2={H - M.b} stroke="var(--c-border)" />
        <line x1={M.l} y1={M.t} x2={M.l} y2={H - M.b} stroke="var(--c-border)" />
        {ticks.map((t) => (
          <g key={t}>
            <line x1={sx(t)} y1={H - M.b} x2={sx(t)} y2={H - M.b + 5} stroke="var(--c-muted)" />
            <text x={sx(t)} y={H - M.b + 18} textAnchor="middle" fontSize={11} fill="var(--c-muted)">
              {formatNumber(t)}
            </text>
          </g>
        ))}
        <text x={(W + M.l) / 2} y={H - 6} textAnchor="middle" fontSize={12} fill="var(--c-muted)">
          time (s)
        </text>
        <text x={M.l - 8} y={sy(yScale) + 4} textAnchor="end" fontSize={11} fill="var(--c-muted)">
          {formatNumber(yScale)} {unit}
        </text>
        <text x={M.l - 8} y={sy(0) + 4} textAnchor="end" fontSize={11} fill="var(--c-muted)">
          0
        </text>
        {/* 63% / 37% reference at t = τ */}
        {tau <= config.tMax && (
          <g>
            <line
              x1={sx(tau)}
              y1={M.t}
              x2={sx(tau)}
              y2={H - M.b}
              stroke="var(--c-accent)"
              strokeDasharray="4 4"
            />
            <text x={sx(tau) + 4} y={M.t + 12} fontSize={11} fill="var(--c-accent)">
              τ = {formatNumber(tau)} s
            </text>
            <line
              x1={M.l}
              y1={sy(ref * yMaxVal)}
              x2={sx(tau)}
              y2={sy(ref * yMaxVal)}
              stroke="var(--c-accent)"
              strokeDasharray="2 4"
              opacity={0.7}
            />
          </g>
        )}
        {config.target && (
          <g>
            <circle
              cx={sx(config.target.t)}
              cy={sy(config.target.frac * yMaxVal)}
              r={7}
              fill="none"
              stroke="var(--c-warn)"
              strokeWidth={2.5}
            />
            <text
              x={sx(config.target.t) + 10}
              y={sy(config.target.frac * yMaxVal) + 16}
              fontSize={11}
              fill="var(--c-warn)"
            >
              target: {Math.round(config.target.frac * 100)}% at {formatNumber(config.target.t)} s
            </text>
          </g>
        )}
        <path d={path} fill="none" stroke="var(--c-text)" strokeWidth={2.5} />
        {config.markers.map((t) => (
          <g key={t}>
            <circle cx={sx(t)} cy={sy(yAt(t, v, config.mode))} r={4} fill="var(--c-accent)" />
            <text x={sx(t) + 6} y={sy(yAt(t, v, config.mode)) - 6} fontSize={11} fill="var(--c-text)">
              {formatNumber(yAt(t, v, config.mode))} {unit} ({Math.round(fracAt(t, tau, config.mode) * 100)}%)
            </text>
          </g>
        ))}
      </svg>

      <div className="grid gap-3 sm:grid-cols-2">
        {config.sliders.map((s) => (
          <label key={s.name} className="flex flex-col gap-1 text-sm" htmlFor={`${id}-${s.name}`}>
            <span className="flex justify-between">
              <span className="font-medium">{s.name}</span>
              <span className="font-mono">
                {formatNumber(v[s.name] / s.scale)} {s.unit}
              </span>
            </span>
            <input
              id={`${id}-${s.name}`}
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={v[s.name]}
              disabled={disabled}
              onChange={(e) =>
                onStateChange({
                  values: { ...state.values, [s.name]: Number(Number(e.target.value).toPrecision(12)) },
                })
              }
              className="accent-[var(--c-accent)]"
              data-slider={s.name}
            />
          </label>
        ))}
      </div>
      <p className="text-sm text-muted">
        Fixed:{' '}
        {Object.entries(config.fixed)
          .filter(([k]) => !config.sliders.some((s) => s.name === k))
          .map(([k, x]) => `${k} = ${friendly(k, x as number)}`)
          .join(', ') || 'nothing'}
        . Time constant τ = {rc ? 'RC' : 'L/R'} = <strong>{formatNumber(tau)} s</strong>.
      </p>
    </div>
  );
}
