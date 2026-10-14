import { useEffect, useRef, useState, type ReactNode } from 'react';

/*
 * The Arcade component kit (§10.5). Everything pressable has a 2 px outline and a hard shadow and
 * drops onto it when pressed (`.press` in index.css). Colours come only from the §10.4 tokens.
 */

// ───────────────────────────── icons (24 px grid, round strokes; bolt and star filled) ─────────────────────────────

function Svg({
  children,
  className = 'h-5 w-5',
  stroke = 2.4,
}: {
  children: ReactNode;
  className?: string;
  stroke?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const CheckIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <Svg className={className} stroke={3.2}>
    <path d="M5 12l5 5L20 7" />
  </Svg>
);
export const CrossIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <Svg className={className} stroke={3}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);
export const ArrowUpIcon = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <Svg className={className} stroke={3}>
    <path d="M12 19V5M5 12l7-7 7 7" />
  </Svg>
);
export const ArrowDownIcon = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <Svg className={className} stroke={3}>
    <path d="M12 5v14M5 12l7 7 7-7" />
  </Svg>
);
export const BackIcon = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <Svg className={className} stroke={2.6}>
    <path d="M15 5l-7 7 7 7" />
  </Svg>
);
export const LockIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <Svg className={className}>
    <rect x="5" y="11" width="14" height="10" rx="2.5" />
    <path d="M8 11V8a4 4 0 018 0v3" />
  </Svg>
);
export const BulbIcon = ({ className = 'h-[18px] w-[18px]' }: { className?: string }) => (
  <Svg className={className}>
    <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z" />
  </Svg>
);
export const LinkIcon = ({ className = 'h-[18px] w-[18px]' }: { className?: string }) => (
  <Svg className={className}>
    <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
    <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
  </Svg>
);
export const PlusIcon = ({ className = 'h-[18px] w-[18px]' }: { className?: string }) => (
  <Svg className={className}>
    <path d="M12 3v18M3 12h18" />
  </Svg>
);
export const BoltIcon = ({ className = 'h-[18px] w-[18px]' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
  </svg>
);
export const CalendarIcon = ({ className = 'h-[22px] w-[22px]' }: { className?: string }) => (
  <Svg className={className}>
    <rect x="3" y="5" width="18" height="16" rx="3" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Svg>
);
export const LearnIcon = ({ className = 'h-[22px] w-[22px]' }: { className?: string }) => (
  <Svg className={className}>
    <circle cx="6" cy="6" r="2.5" />
    <circle cx="18" cy="18" r="2.5" />
    <path d="M8.5 6H14a3.5 3.5 0 010 7h-4a3.5 3.5 0 000 7h5.5" />
  </Svg>
);
export const ChartIcon = ({ className = 'h-[22px] w-[22px]' }: { className?: string }) => (
  <Svg className={className}>
    <path d="M4 4v16h16M8 15l4-5 3 3 5-6" />
  </Svg>
);
export const PuzzleIcon = ({ className = 'h-[22px] w-[22px]' }: { className?: string }) => (
  <Svg className={className}>
    <path d="M10 3h4v3a2 2 0 104 0V3h3v7h-3a2 2 0 100 4h3v7h-7v-3a2 2 0 10-4 0v3H3v-7h3a2 2 0 100-4H3V3h7z" />
  </Svg>
);
export const ProfileIcon = ({ className = 'h-[22px] w-[22px]' }: { className?: string }) => (
  <Svg className={className}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0116 0" />
  </Svg>
);
export const SettingsIcon = ({ className = 'h-[22px] w-[22px]' }: { className?: string }) => (
  <Svg className={className}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
  </Svg>
);

/** The small battery used for streak charges (mint fill). */
export function ChargeIcon({ full }: { full: boolean }) {
  return (
    <svg viewBox="0 0 12 20" className="h-5 w-3" aria-hidden="true">
      <rect x="3.5" y="0.5" width="5" height="2.5" rx="1" fill="currentColor" />
      <rect
        x="1"
        y="2.5"
        width="10"
        height="16.5"
        rx="2.5"
        fill={full ? 'var(--correct)' : 'var(--surface)'}
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

// ───────────────────────────── buttons ─────────────────────────────

type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';

const BUTTON: Record<ButtonVariant, string> = {
  primary: 'press press-s2 bg-primary text-on-primary min-h-[52px] px-5 text-[18px]',
  accent: 'press press-s2 bg-volt text-on-fill min-h-[52px] px-5 text-[18px]',
  secondary: 'press press-s1 bg-surface text-ink min-h-[46px] px-4 text-body',
  ghost: 'text-primary-ink underline-offset-4 hover:underline min-h-[44px] px-2 text-body',
  danger: 'press press-s2 bg-wrong text-on-fill min-h-[52px] px-5 text-[18px]',
};

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-md font-extrabold ${BUTTON[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Classes for a link that looks like a button. */
export function buttonClass(variant: ButtonVariant = 'primary', extra = ''): string {
  return `inline-flex items-center justify-center gap-2 rounded-md font-extrabold no-underline ${BUTTON[variant]} ${extra}`;
}

export function IconButton({
  label,
  children,
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`press press-s1 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-surface text-ink ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

// ───────────────────────────── tags, chips, stars ─────────────────────────────

type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'bad' | 'ink' | 'dashed';

const TAG: Record<Tone, string> = {
  neutral: 'border-2 border-outline bg-surface text-ink',
  accent: 'border-2 border-primary bg-surface-tint text-primary-ink',
  ok: 'border-2 border-outline bg-correct-tint text-ink',
  warn: 'border-2 border-outline bg-volt text-on-fill',
  bad: 'border-2 border-outline bg-wrong-tint text-ink',
  ink: 'border-2 border-outline bg-ink text-ground',
  dashed: 'border-2 border-dashed border-ink-3 text-ink-2',
};

/** Status tag (§10.5): `r-sm`, 2 px outline. */
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-caption font-bold whitespace-nowrap ${TAG[tone]}`}
    >
      {children}
    </span>
  );
}

/** Concept chip: tint, pill, small 600. */
export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-surface-tint px-3 py-1 text-small font-semibold text-ink">
      {children}
    </span>
  );
}

export function Stars({ count, size = 'sm' }: { count: number; size?: 'sm' | 'md' }) {
  const px = size === 'sm' ? 16 : 22;
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${count} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <svg key={i} width={px} height={px} viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 2l3 6.5 7 .8-5.2 4.8 1.5 7L12 17.6 5.7 21l1.5-7L2 9.3l7-.8z"
            fill={i < count ? 'var(--volt)' : 'var(--surface)'}
            stroke="var(--outline)"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
  );
}

// ───────────────────────────── progress ─────────────────────────────

/** Daily goal ring (§10.5): 12 px stroke, tint track, violet progress, the number in the centre. */
export function ProgressRing({
  value,
  size = 72,
  stroke = 12,
  label,
  center,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label: string;
  center?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface-tint)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * v} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span
        className="tabular absolute inset-0 flex items-center justify-center text-[19px] font-extrabold"
        aria-hidden="true"
      >
        {center ?? `${Math.round(v * 100)}%`}
      </span>
    </span>
  );
}

/**
 * The progress battery (§10.5): an ink frame with a terminal nub, one cell per screen. `burst` plays
 * the completion fill — remaining cells fill left to right, then volt sparks from the last cell (§10.6).
 */
export function ProgressBattery({
  total,
  done,
  current,
  label,
  height = 16,
  burst = false,
}: {
  total: number;
  done: number;
  current?: number;
  label: string;
  height?: number;
  burst?: boolean;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className="flex min-w-0 flex-1 items-center gap-1"
      data-testid="progress-battery"
    >
      <div className="relative flex min-w-0 flex-1 gap-[3px] rounded-sm bg-board p-1">
        {Array.from({ length: total }, (_, i) => {
          const isDone = i < done;
          const isCurrent = !isDone && i === current;
          const fills = burst && !isDone;
          return (
            <span
              key={i}
              className={`flex-1 rounded-[4px] ${isDone ? 'bg-cell-done' : isCurrent ? 'bg-cell-current' : 'bg-cell-todo'} ${fills ? 'anim-cell-fill' : ''}`}
              style={{ height, animationDelay: fills ? `${(i - done) * 60}ms` : undefined }}
              data-cell={isDone ? 'done' : isCurrent ? 'current' : 'todo'}
            />
          );
        })}
        {burst && <Sparks delay={Math.max(0, total - done) * 60} />}
      </div>
      <span className="h-3 w-1.5 rounded-r-[3px] bg-board" aria-hidden="true" />
    </div>
  );
}

function Sparks({ delay }: { delay: number }) {
  return (
    <span className="pointer-events-none absolute right-1 top-1/2" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <span
            key={i}
            className="anim-spark absolute h-2 w-2 rounded-full bg-volt"
            style={
              {
                '--dx': `${Math.cos(a) * 28}px`,
                '--dy': `${Math.sin(a) * 28}px`,
                animationDelay: `${delay}ms`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </span>
  );
}

/** Counts a number up when it rises (§10.6 "the XP pill counts up"); instant under reduced motion. */
export function useCountUp(value: number, ms = 500): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    from.current = value;
    const reduce =
      typeof window === 'undefined' ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.dataset.motion === 'reduce';
    if (value <= start || reduce) {
      setShown(value);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      setShown(Math.round(start + (value - start) * k));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}

/** XP pill (§10.5): volt fill, bolt icon, the number in 800. */
export function XpPill({ xp }: { xp: number }) {
  const shown = useCountUp(xp);
  return (
    <span
      className="tabular inline-flex items-center gap-1.5 rounded-full border-2 border-outline bg-volt py-1.5 pl-2.5 pr-3.5 font-extrabold text-on-fill"
      aria-label={`${xp} XP`}
      data-testid="xp-pill"
    >
      <BoltIcon />
      <span aria-hidden="true">{shown} XP</span>
    </span>
  );
}

/** Streak pill: bolt + days, and up to two charge batteries (§10.5). The number rolls up when it grows. */
export function StreakPill({ days, charges }: { days: number; charges: number }) {
  return (
    <span
      className="tabular inline-flex items-center gap-1.5 rounded-full border-2 border-outline bg-volt py-1.5 pl-2.5 pr-3 font-extrabold text-on-fill"
      aria-label={`${days}-day streak, ${charges} streak charge${charges === 1 ? '' : 's'}`}
      data-testid="streak-pill"
    >
      <BoltIcon />
      <span key={days} className="anim-roll" aria-hidden="true">
        {days}
      </span>
      <span className="flex gap-0.5" aria-hidden="true">
        {[0, 1].map((i) => (
          <ChargeIcon key={i} full={i < charges} />
        ))}
      </span>
    </span>
  );
}

// ───────────────────────────── states ─────────────────────────────

export function Loading({ what = 'Loading' }: { what?: string }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 text-ink-2" role="status" aria-live="polite">
      {what}…
    </div>
  );
}

export function ErrorState({ error }: { error: Error }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16" role="alert">
      <h1 className="text-h2">Something went wrong</h1>
      <p className="mt-2 text-ink-2">{error.message}</p>
    </div>
  );
}

/** A 2 px outlined card; `shadow` adds the hard shadow for hero and question cards. */
export function Card({
  children,
  className = '',
  shadow = 'none',
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { shadow?: 'none' | 's1' | 's2' | 's3' }) {
  const s = { none: '', s1: 'shadow-s1', s2: 'shadow-s2', s3: 'shadow-s3' }[shadow];
  return (
    <div className={`rounded-lg border-2 border-outline bg-surface ${s} ${className}`} {...rest}>
      {children}
    </div>
  );
}
