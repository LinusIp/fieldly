import { useEffect, useRef } from 'react';
import { Markdown } from '../components/Markdown';
import { CheckIcon, CrossIcon } from '../components/ui';
import { math, type Scope } from '../engine/expr';
import { formatNumber } from '../engine/format';
import { renderTemplate } from '../engine/template';
import { ticks } from '../interactives/plot';
import { normaliseInput } from './common';

/** Shared pieces for widget views: templated Markdown, marks, keys and small plots. */

export function Tx({ s, scope, inline = true }: { s: string; scope: Scope; inline?: boolean }) {
  return <Markdown inline={inline}>{renderTemplate(s, scope)}</Markdown>;
}

/** Icon + text + colour for a marked part (never colour alone, §10.3). */
export function Mark({ ok, label }: { ok: boolean; label?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 text-sm font-semibold ${ok ? 'text-ok' : 'text-bad'}`}
    >
      {ok ? <CheckIcon /> : <CrossIcon />}
      {label ?? (ok ? 'Right' : 'Wrong')}
    </span>
  );
}

export function markClass(state: 'ok' | 'bad' | 'picked' | 'none'): string {
  return {
    ok: 'border-ok bg-ok-soft',
    bad: 'border-bad bg-bad-soft',
    picked: 'border-accent bg-accent-soft',
    none: 'border-border',
  }[state];
}

/** `1`–`9` pick the n-th choice while `enabled` (§2.5). Typing in a text field is left alone. */
export function useDigitKeys(enabled: boolean, count: number, onDigit: (i: number) => void) {
  const ref = useRef(onDigit);
  useEffect(() => {
    ref.current = onDigit;
  });
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) return;
      if (tag === 'INPUT' && !['radio', 'checkbox'].includes((t as HTMLInputElement).type)) return;
      if (!/^[1-9]$/.test(e.key)) return;
      const i = Number(e.key) - 1;
      if (i < count) {
        e.preventDefault();
        ref.current(i);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, count]);
}

function sample(expr: string, scope: Scope, x0: number, x1: number, n = 80): [number, number][] {
  let f: { evaluate(scope: Scope): unknown };
  try {
    f = math.compile(normaliseInput(expr));
  } catch {
    return [];
  }
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    try {
      const y = f.evaluate({ ...scope, x });
      if (typeof y === 'number' && Number.isFinite(y)) pts.push([x, y]);
    } catch {
      /* skip */
    }
  }
  return pts;
}

function pathOf(pts: [number, number][], sx: (x: number) => number, sy: (y: number) => number): string {
  return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join('');
}

/** A small plot of y = expr(x), for match and odd-one-out items. */
export function MiniPlot({
  plot,
  x = [-3, 3],
  scope,
  label,
}: {
  plot: string;
  x?: [number, number];
  scope: Scope;
  label?: string;
}) {
  const W = 140;
  const H = 90;
  const pts = sample(plot, scope, x[0], x[1]);
  const ys = pts.map((p) => p[1]);
  let y0 = Math.min(0, ...ys);
  let y1 = Math.max(0, ...ys);
  if (!(y1 > y0)) [y0, y1] = [y0 - 1, y1 + 1];
  const sx = (v: number) => 6 + ((v - x[0]) / (x[1] - x[0])) * (W - 12);
  const sy = (v: number) => H - 6 - ((v - y0) / (y1 - y0)) * (H - 12);
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={label ?? `graph of y = ${plot}`}
    >
      <line x1={sx(x[0])} x2={sx(x[1])} y1={sy(0)} y2={sy(0)} stroke="var(--c-border)" />
      {x[0] < 0 && x[1] > 0 && <line x1={sx(0)} x2={sx(0)} y1={6} y2={H - 6} stroke="var(--c-border)" />}
      <path d={pathOf(pts, sx, sy)} fill="none" stroke="var(--c-accent)" strokeWidth={2} />
    </svg>
  );
}

/** After the final attempt: the learner's number on a line next to the correct value (§2.5). */
export function NumberLine({ learner, correct, unit }: { learner: number; correct: number; unit?: string }) {
  const W = 320;
  const lo0 = Math.min(learner, correct);
  const hi0 = Math.max(learner, correct);
  const pad = (hi0 - lo0 || Math.abs(correct) || 1) * 0.3;
  const lo = lo0 - pad;
  const hi = hi0 + pad;
  const sx = (v: number) => 16 + ((v - lo) / (hi - lo)) * (W - 32);
  const u = unit ? ` ${unit}` : '';
  return (
    <figure className="mt-2" data-testid="number-line">
      <svg
        width="100%"
        viewBox={`0 0 ${W} 54`}
        role="img"
        aria-label={`Your answer ${formatNumber(learner)}${u}; correct ${formatNumber(correct)}${u}`}
      >
        <line x1={16} x2={W - 16} y1={30} y2={30} stroke="var(--c-border)" strokeWidth={2} />
        {ticks(lo, hi).map((t) => (
          <g key={t}>
            <line x1={sx(t)} x2={sx(t)} y1={26} y2={34} stroke="var(--c-border)" />
            <text x={sx(t)} y={48} fontSize={9} textAnchor="middle" fill="var(--c-muted)">
              {formatNumber(t)}
            </text>
          </g>
        ))}
        <circle cx={sx(correct)} cy={30} r={6} fill="var(--c-ok)" />
        <text x={sx(correct)} y={14} fontSize={10} textAnchor="middle" fill="var(--c-ok)">
          correct
        </text>
        {learner !== correct && (
          <>
            <rect x={sx(learner) - 5} y={25} width={10} height={10} fill="var(--c-bad)" />
            <text x={sx(learner)} y={14} fontSize={10} textAnchor="middle" fill="var(--c-bad)">
              you
            </text>
          </>
        )}
      </svg>
    </figure>
  );
}

/** After the final attempt: the learner's expression plotted against the answer (one variable). */
export function ExprCompare({
  learner,
  correct,
  variable,
  range,
  scope,
}: {
  learner: string;
  correct: string;
  variable: string;
  range: [number, number];
  scope: Scope;
}) {
  const W = 320;
  const H = 150;
  const sub = (e: string) => {
    try {
      return math
        .parse(normaliseInput(e))
        .transform((n) => {
          const s = n as unknown as { isSymbolNode?: boolean; name?: string };
          return s.isSymbolNode && s.name === variable ? new math.SymbolNode('x') : n;
        })
        .toString();
    } catch {
      return '';
    }
  };
  const a = sample(sub(correct), scope, range[0], range[1]);
  const b = sample(sub(learner), {}, range[0], range[1]);
  const ys = [...a, ...b].map((p) => p[1]);
  if (ys.length === 0) return null;
  let y0 = Math.min(...ys);
  let y1 = Math.max(...ys);
  if (!(y1 > y0)) [y0, y1] = [y0 - 1, y1 + 1];
  const sx = (v: number) => 8 + ((v - range[0]) / (range[1] - range[0])) * (W - 16);
  const sy = (v: number) => H - 8 - ((v - y0) / (y1 - y0)) * (H - 16);
  return (
    <figure className="mt-2" data-testid="expr-compare">
      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Your expression plotted against the correct one over ${variable} from ${range[0]} to ${range[1]}`}
      >
        <rect x={0} y={0} width={W} height={H} fill="var(--c-bg)" rx={8} />
        <path d={pathOf(a, sx, sy)} fill="none" stroke="var(--c-ok)" strokeWidth={2.5} />
        <path d={pathOf(b, sx, sy)} fill="none" stroke="var(--c-bad)" strokeWidth={2} strokeDasharray="6 4" />
      </svg>
      <figcaption className="text-xs text-muted">
        <span className="text-ok">━ correct</span> · <span className="text-bad">╍ yours</span> (over{' '}
        {variable} from {range[0]} to {range[1]})
      </figcaption>
    </figure>
  );
}
