import { useId } from 'react';
import { formatNumber } from '../../engine/format';
import { ticks } from '../plot';
import type { ChallengeComponentProps } from '../types';
import {
  checkScope,
  fOf,
  partialSum,
  taylorPoly,
  type Config,
  type SeriesConfig,
  type State,
  type TaylorConfig,
} from './logic';

const W = 640;
const H = 260;
const M = { l: 52, r: 12, t: 14, b: 30 };

function Axes({
  x,
  y,
  sx,
  sy,
  xLabel,
}: {
  x: [number, number];
  y: [number, number];
  sx: (v: number) => number;
  sy: (v: number) => number;
  xLabel: string;
}) {
  return (
    <>
      <rect x={0} y={0} width={W} height={H} fill="var(--c-bg)" rx={10} />
      {ticks(x[0], x[1]).map((t) => (
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
      {ticks(y[0], y[1]).map((t) => (
        <g key={`y${t}`}>
          <line x1={M.l} y1={sy(t)} x2={W - M.r} y2={sy(t)} stroke="var(--c-border)" opacity={0.5} />
          <text x={M.l - 6} y={sy(t) + 4} textAnchor="end" fontSize={11} fill="var(--c-muted)">
            {formatNumber(t)}
          </text>
        </g>
      ))}
      {y[0] <= 0 && y[1] >= 0 && <line x1={M.l} y1={sy(0)} x2={W - M.r} y2={sy(0)} stroke="var(--c-muted)" />}
      <text x={W - M.r} y={H - 4} textAnchor="end" fontSize={11} fill="var(--c-muted)">
        {xLabel}
      </text>
    </>
  );
}

function scales(x: [number, number], y: [number, number]) {
  const sx = (v: number) => M.l + ((v - x[0]) / (x[1] - x[0] || 1)) * (W - M.l - M.r);
  const sy = (v: number) =>
    H - M.b - ((Math.min(y[1], Math.max(y[0], v)) - y[0]) / (y[1] - y[0] || 1)) * (H - M.t - M.b);
  return { sx, sy };
}

function range(vals: number[], extra: number[] = []): [number, number] {
  const all = [...vals, ...extra, 0].filter(Number.isFinite);
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  const pad = (hi - lo || 1) * 0.08;
  lo -= lo < 0 ? pad : 0;
  hi += pad;
  return [lo, hi];
}

function SeriesPlots({ config, N }: { config: SeriesConfig; N: number }) {
  const ns = Array.from({ length: config.NMax - config.n0 + 1 }, (_, i) => config.n0 + i);
  const x: [number, number] = [config.n0 - 0.5, config.NMax + 0.5];
  const termsY = range(config.terms);
  const sums = ns.map((n) => partialSum(config, n));
  const sumsY = range(sums, config.limit !== undefined ? [config.limit] : []);
  const t = scales(x, termsY);
  const p = scales(x, sumsY);
  const shown = ns.filter((n) => n <= N);
  return (
    <div className="grid gap-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Terms of the series"
        data-testid="series-terms"
      >
        <Axes x={x} y={termsY} sx={t.sx} sy={t.sy} xLabel="n — terms aₙ" />
        {shown.map((n) => (
          <g key={n}>
            <line
              x1={t.sx(n)}
              y1={t.sy(0)}
              x2={t.sx(n)}
              y2={t.sy(config.terms[n - config.n0])}
              stroke="var(--c-accent)"
              strokeWidth={2}
            />
            <circle cx={t.sx(n)} cy={t.sy(config.terms[n - config.n0])} r={3} fill="var(--c-accent)" />
          </g>
        ))}
      </svg>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Partial sums"
        data-testid="series-sums"
      >
        <Axes x={x} y={sumsY} sx={p.sx} sy={p.sy} xLabel="N — partial sums S_N" />
        {config.limit !== undefined && (
          <line
            x1={M.l}
            y1={p.sy(config.limit)}
            x2={W - M.r}
            y2={p.sy(config.limit)}
            stroke="var(--c-warn)"
            strokeDasharray="6 4"
          />
        )}
        <path
          d={shown
            .map((n, i) => `${i ? 'L' : 'M'}${p.sx(n).toFixed(1)},${p.sy(sums[n - config.n0]).toFixed(1)}`)
            .join('')}
          fill="none"
          stroke="var(--c-text)"
          strokeWidth={2}
        />
        {shown.map((n) => (
          <circle key={n} cx={p.sx(n)} cy={p.sy(sums[n - config.n0])} r={2.5} fill="var(--c-text)" />
        ))}
      </svg>
    </div>
  );
}

function TaylorPlot({ config, degree }: { config: TaylorConfig; degree: number }) {
  const { sx, sy } = scales(config.view.x, config.view.y);
  const f = fOf(config);
  const T = taylorPoly(config, degree);
  const [y0, y1] = config.view.y;
  const pathOf = (g: (x: number) => number) => {
    let d = '';
    let pen = false;
    for (let i = 0; i <= 400; i++) {
      const xv = config.view.x[0] + ((config.view.x[1] - config.view.x[0]) * i) / 400;
      const yv = g(xv);
      const ok = Number.isFinite(yv) && yv > y0 - (y1 - y0) && yv < y1 + (y1 - y0);
      if (ok) d += `${pen ? 'L' : 'M'}${sx(xv).toFixed(1)},${sy(yv).toFixed(1)}`;
      pen = ok;
    }
    return d;
  };
  return (
    <svg
      viewBox={`0 0 ${W} ${H + 60}`}
      className="w-full"
      role="img"
      aria-label="Function and Taylor polynomial"
      data-testid="taylor-plot"
    >
      <g transform="translate(0, 30)">
        <Axes x={config.view.x} y={config.view.y} sx={sx} sy={sy} xLabel="x" />
        <rect
          x={sx(config.interval[0])}
          y={M.t}
          width={sx(config.interval[1]) - sx(config.interval[0])}
          height={H - M.t - M.b}
          fill="var(--c-accent)"
          opacity={0.08}
        />
        <path d={pathOf(f)} fill="none" stroke="var(--c-text)" strokeWidth={2.5} />
        <path d={pathOf(T)} fill="none" stroke="var(--c-accent)" strokeWidth={2.2} strokeDasharray="7 4" />
        <circle cx={sx(config.center)} cy={sy(f(config.center))} r={4} fill="var(--c-warn)" />
      </g>
      <text x={M.l} y={18} fontSize={12} fill="var(--c-text)">
        — f(x)
      </text>
      <text x={M.l + 70} y={18} fontSize={12} fill="var(--c-accent)">
        - - Taylor polynomial, degree {degree}
      </text>
    </svg>
  );
}

export function SeriesExplorer({
  config,
  state,
  disabled,
  onStateChange,
}: ChallengeComponentProps<Config, State>) {
  const id = useId();
  const s = checkScope(state, config);
  const series = config.mode === 'series';
  const k = (series ? s.N : s.degree) as number;
  const [lo, hi] = series ? [config.n0, config.NMax] : [0, config.degreeMax];
  const fmt = (v: unknown) => formatNumber(v as number, { sig: 6 });
  return (
    <div className="space-y-4">
      {series ? <SeriesPlots config={config} N={k} /> : <TaylorPlot config={config} degree={k} />}
      <label className="flex flex-col gap-1 text-sm" htmlFor={`${id}-k`}>
        <span className="flex justify-between">
          <span className="font-medium">{series ? 'N (terms added)' : 'Degree'}</span>
          <span className="font-mono">{k}</span>
        </span>
        <input
          id={`${id}-k`}
          type="range"
          min={lo}
          max={hi}
          step={1}
          value={k}
          disabled={disabled}
          onChange={(e) => onStateChange({ k: Number(e.target.value) })}
          className="accent-[var(--c-accent)]"
          data-slider={series ? 'N' : 'degree'}
          aria-label={series ? 'N, terms added' : 'Degree'}
        />
      </label>
      <p className="font-mono text-sm" data-testid="series-readouts">
        {series
          ? `S_${k} = ${fmt(s.SN)}` +
            (s.limit !== undefined ? ` · sum ${fmt(s.limit)} · error ${formatNumber(s.error as number)}` : '')
          : `largest error on [${formatNumber(config.interval[0])}, ${formatNumber(config.interval[1])}] = ${formatNumber(s.maxErrorOnInterval as number)}` +
            (s.error !== undefined
              ? ` · error at x = ${formatNumber(config.at!)}: ${formatNumber(s.error as number)}`
              : '')}
      </p>
    </div>
  );
}
