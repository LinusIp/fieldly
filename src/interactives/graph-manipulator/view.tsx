import { useId, useRef } from 'react';
import { formatNumber } from '../../engine/format';
import { ticks } from '../plot';
import type { ChallengeComponentProps } from '../types';
import { checkScope, currentValues, domain, model, type Config, type Control, type State } from './model';

const W = 640;
const H = 360;
const M = { l: 44, r: 12, t: 12, b: 32 };
const SAMPLES = 480;

function snap(x: number, k: Control): number {
  const clamped = Math.min(k.max, Math.max(k.min, x));
  const snapped = k.min + Math.round((clamped - k.min) / k.step) * k.step;
  return Number(Math.min(k.max, snapped).toPrecision(12));
}

export function GraphManipulator({
  config,
  state,
  disabled,
  onStateChange,
}: ChallengeComponentProps<Config, State>) {
  const id = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<string | null>(null);
  const values = currentValues(state, config);
  const m = model(config, values);
  const [x0v, x1v] = m.view.x;
  const [y0v, y1v] = m.view.y;
  const sx = (x: number) => M.l + ((x - x0v) / (x1v - x0v)) * (W - M.l - M.r);
  const sy = (y: number) => H - M.b - ((y - y0v) / (y1v - y0v)) * (H - M.t - M.b);
  const yPad = (y1v - y0v) * 2;
  const inRange = (y: number) => Number.isFinite(y) && y > y0v - yPad && y < y1v + yPad;

  /** Path through sampled points, broken where the curve is undefined, leaves the view or jumps. */
  const pathOf = (pt: (u: number) => [number, number], [lo, hi]: [number, number]) => {
    let d = '';
    let pen = false;
    let prevY = NaN;
    for (let i = 0; i <= SAMPLES; i++) {
      const [x, y] = pt(lo + ((hi - lo) * i) / SAMPLES);
      const ok = Number.isFinite(x) && inRange(y) && !(pen && Math.abs(y - prevY) > (y1v - y0v) * 0.9);
      if (ok) {
        d += `${pen ? 'L' : 'M'}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`;
        pen = true;
        prevY = y;
      } else pen = false;
    }
    return d;
  };
  const fnPath = (g: (x: number) => number) => pathOf((x) => [x, g(x)], m.view.x);

  const update = (name: string, v: number) => onStateChange({ values: { ...values, [name]: v } });

  const toX = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return x0v + ((p.x - M.l) / (W - M.l - M.r)) * (x1v - x0v);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const k = config.controls.find((c) => c.name === dragging.current);
    if (!k || disabled) return;
    const x = toX(e.clientX, e.clientY);
    if (x !== null) update(k.name, snap(x, k));
  };
  // Pressing anywhere on the plot moves the nearest draggable control there and starts dragging —
  // so a control that is outside a zoomed-in view can still be reached.
  const draggable = config.controls.filter((k) => k.drag);
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (disabled || !draggable.length || (e.target as Element).closest('[data-handle]')) return;
    const x = toX(e.clientX, e.clientY);
    if (x === null) return;
    const k = draggable.reduce((best, c) =>
      Math.abs(values[c.name] - x) < Math.abs(values[best.name] - x) ? c : best,
    );
    dragging.current = k.name;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    update(k.name, snap(x, k));
  };

  const f = m.f;
  const fp = m.fp;
  const x0 = m.x0;
  const line = (px: number, py: number, slope: number) =>
    `M${sx(x0v).toFixed(1)},${sy(py + slope * (x0v - px)).toFixed(1)}L${sx(x1v).toFixed(1)},${sy(py + slope * (x1v - px)).toFixed(1)}`;

  // Shaded signed area between the curve and the x-axis on [a, b].
  let areaPath = '';
  if (f && m.area) {
    const lo = Math.max(Math.min(m.area.a, m.area.b), x0v);
    const hi = Math.min(Math.max(m.area.a, m.area.b), x1v);
    if (hi > lo) {
      const n = 160;
      const clampY = (y: number) => Math.min(y1v, Math.max(y0v, Number.isFinite(y) ? y : 0));
      areaPath = `M${sx(lo).toFixed(1)},${sy(0).toFixed(1)}`;
      for (let i = 0; i <= n; i++) {
        const x = lo + ((hi - lo) * i) / n;
        areaPath += `L${sx(x).toFixed(1)},${sy(clampY(f(x))).toFixed(1)}`;
      }
      areaPath += `L${sx(hi).toFixed(1)},${sy(0).toFixed(1)}Z`;
    }
  }

  // Readouts use the same numbers the checks see.
  const s = checkScope(state, config);
  const num = (k: string) => (typeof s[k] === 'number' ? formatNumber(s[k] as number, { sig: 4 }) : '—');
  const readouts: string[] = [];
  if (f && x0 !== undefined && (config.tangents.length || config.secant || config.accumulation)) {
    readouts.push(`f(${formatNumber(x0, { sig: 6 })}) = ${num('fx0')}`);
    if (config.tangents.length) readouts.push(`tangent slope ${num('fpx0')}`);
    if (config.secant) readouts.push(`secant slope ${num('secantSlope')}`);
    if (config.accumulation) readouts.push(`A(${formatNumber(x0, { sig: 6 })}) = ${num('Ax0')}`);
  }
  if (config.area) readouts.push(`signed area ${num('area')}`);
  if (config.data.length) readouts.push(`sum of squared errors ${num('sse')}`);
  if (config.target) readouts.push(`largest gap to target ${num('matchError')}`);

  return (
    <div className="space-y-4">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none"
        role="img"
        aria-label="Graph"
        data-testid="graph-plot"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (dragging.current = null)}
        onPointerLeave={() => (dragging.current = null)}
      >
        <rect x={0} y={0} width={W} height={H} fill="var(--c-bg)" rx={10} />
        <defs>
          <clipPath id={`${id}-clip`}>
            <rect x={M.l} y={M.t} width={W - M.l - M.r} height={H - M.t - M.b} />
          </clipPath>
        </defs>
        {ticks(x0v, x1v).map((t) => (
          <g key={`x${t}`}>
            <line x1={sx(t)} y1={M.t} x2={sx(t)} y2={H - M.b} stroke="var(--c-border)" opacity={0.5} />
            <text x={sx(t)} y={H - M.b + 16} textAnchor="middle" fontSize={11} fill="var(--c-muted)">
              {formatNumber(t)}
            </text>
          </g>
        ))}
        {ticks(y0v, y1v).map((t) => (
          <g key={`y${t}`}>
            <line x1={M.l} y1={sy(t)} x2={W - M.r} y2={sy(t)} stroke="var(--c-border)" opacity={0.5} />
            <text x={M.l - 6} y={sy(t) + 4} textAnchor="end" fontSize={11} fill="var(--c-muted)">
              {formatNumber(t)}
            </text>
          </g>
        ))}
        <g clipPath={`url(#${id}-clip)`}>
          {y0v <= 0 && y1v >= 0 && (
            <line x1={M.l} y1={sy(0)} x2={W - M.r} y2={sy(0)} stroke="var(--c-muted)" />
          )}
          {x0v <= 0 && x1v >= 0 && (
            <line x1={sx(0)} y1={M.t} x2={sx(0)} y2={H - M.b} stroke="var(--c-muted)" />
          )}
          {m.band && (
            <g data-testid="graph-band">
              <rect
                x={M.l}
                y={sy(m.band.y + m.band.eps)}
                width={W - M.l - M.r}
                height={Math.max(0, sy(m.band.y - m.band.eps) - sy(m.band.y + m.band.eps))}
                fill="var(--c-accent)"
                opacity={0.12}
              />
              <line
                x1={M.l}
                y1={sy(m.band.y)}
                x2={W - M.r}
                y2={sy(m.band.y)}
                stroke="var(--c-accent)"
                strokeDasharray="4 4"
              />
              {m.band.x !== undefined && m.band.dx !== undefined && (
                <g data-testid="graph-delta">
                  <rect
                    x={sx(m.band.x - m.band.dx)}
                    y={M.t}
                    width={Math.max(0, sx(m.band.x + m.band.dx) - sx(m.band.x - m.band.dx))}
                    height={H - M.t - M.b}
                    fill="var(--c-warn)"
                    opacity={0.1}
                  />
                  {[m.band.x - m.band.dx, m.band.x + m.band.dx].map((xx) => (
                    <line key={xx} x1={sx(xx)} y1={M.t} x2={sx(xx)} y2={H - M.b} stroke="var(--c-warn)" />
                  ))}
                </g>
              )}
              {m.band.x !== undefined && (
                <line
                  x1={sx(m.band.x)}
                  y1={M.t}
                  x2={sx(m.band.x)}
                  y2={H - M.b}
                  stroke="var(--c-accent)"
                  strokeDasharray="4 4"
                />
              )}
            </g>
          )}
          {areaPath && <path d={areaPath} fill="var(--c-accent)" opacity={0.25} />}
          {m.target && (
            <path
              d={pathOf(m.target, domain(config, m))}
              fill="none"
              stroke="var(--c-warn)"
              strokeWidth={2.5}
              strokeDasharray="7 5"
              data-testid="graph-target"
            />
          )}
          {config.derivative && fp && (
            <path
              d={fnPath(fp)}
              fill="none"
              stroke="var(--c-accent)"
              strokeWidth={1.8}
              strokeDasharray="5 4"
            />
          )}
          {m.A && (
            <path d={fnPath(m.A)} fill="none" stroke="var(--c-ok)" strokeWidth={2} strokeDasharray="2 3" />
          )}
          <path d={pathOf(m.main, domain(config, m))} fill="none" stroke="var(--c-text)" strokeWidth={2.5} />
          {f &&
            fp &&
            m.tangents.map((x, i) => {
              const y = f(x);
              return Number.isFinite(y) ? (
                <path key={i} d={line(x, y, fp(x))} stroke="var(--c-accent)" strokeWidth={1.8} fill="none" />
              ) : null;
            })}
          {f &&
            m.secant &&
            (() => {
              const { at: x, h } = m.secant;
              const y = f(x);
              const y2 = f(x + h);
              if (!Number.isFinite(y) || !Number.isFinite(y2) || h === 0) return null;
              return (
                <g>
                  <path d={line(x, y, (y2 - y) / h)} stroke="var(--c-warn)" strokeWidth={1.8} fill="none" />
                  <circle cx={sx(x + h)} cy={sy(y2)} r={4} fill="var(--c-warn)" />
                </g>
              );
            })()}
          {config.data.map(([x, y], i) => (
            <circle key={i} cx={sx(x)} cy={sy(y)} r={4} fill="var(--c-accent)" />
          ))}
        </g>
        {f &&
          draggable
            .filter((k) => values[k.name] >= x0v && values[k.name] <= x1v)
            .map((k) => {
              const x = values[k.name];
              const y = f(x);
              const cy = Number.isFinite(y)
                ? sy(Math.min(y1v, Math.max(y0v, y)))
                : sy(Math.max(y0v, Math.min(y1v, 0)));
              return (
                <g
                  key={k.name}
                  className={disabled ? undefined : 'cursor-grab'}
                  onPointerDown={(e) => {
                    if (disabled) return;
                    dragging.current = k.name;
                    (e.target as Element).setPointerCapture?.(e.pointerId);
                  }}
                  data-handle={k.name}
                >
                  <circle cx={sx(x)} cy={cy} r={14} fill="transparent" />
                  <circle
                    cx={sx(x)}
                    cy={cy}
                    r={7}
                    fill={Number.isFinite(y) ? 'var(--c-accent)' : 'var(--c-bg)'}
                    stroke="var(--c-accent)"
                    strokeWidth={2.5}
                  />
                  <text x={sx(x)} y={cy - 12} textAnchor="middle" fontSize={11} fill="var(--c-text)">
                    {k.label}
                  </text>
                </g>
              );
            })}
      </svg>

      <div className="grid gap-3 sm:grid-cols-2">
        {config.controls.map((k) => (
          <label key={k.name} className="flex flex-col gap-1 text-sm" htmlFor={`${id}-${k.name}`}>
            <span className="flex justify-between">
              <span className="font-medium">{k.label}</span>
              <span className="font-mono">{formatNumber(values[k.name], { sig: 6 })}</span>
            </span>
            <input
              id={`${id}-${k.name}`}
              type="range"
              min={k.min}
              max={k.max}
              step={k.step}
              value={values[k.name]}
              disabled={disabled}
              onChange={(e) => update(k.name, snap(Number(e.target.value), k))}
              className="accent-[var(--c-accent)]"
              data-slider={k.name}
              aria-label={k.label}
            />
          </label>
        ))}
      </div>
      {readouts.length > 0 && (
        <p className="font-mono text-sm" data-testid="graph-readouts">
          {readouts.join(' · ')}
        </p>
      )}
    </div>
  );
}
