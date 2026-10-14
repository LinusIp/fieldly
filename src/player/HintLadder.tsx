import { Markdown } from '../components/Markdown';

export interface RenderedHints {
  nudge: string;
  buildsOn: string | null;
  partial: string;
}

/** Tiers on offer: `buildsOn` is skipped when there is nothing to build on (§2.5). */
export function hintTiers(h: RenderedHints): { tier: number; title: string; text: string }[] {
  const tiers = [{ tier: 1, title: 'Nudge', text: h.nudge }];
  if (h.buildsOn) tiers.push({ tier: 2, title: 'Builds on', text: h.buildsOn });
  tiers.push({ tier: 3, title: 'Partial solution', text: h.partial });
  return tiers;
}

/** The next tier after `used`, or null when all are open. */
export function nextHintTier(h: RenderedHints, used: number): number | null {
  return hintTiers(h).find((x) => x.tier > used)?.tier ?? null;
}

/** On demand, never automatic; each tier lowers the step's score a little (§2.5–2.6). */
export function HintLadder({
  hints,
  used,
  disabled,
  onOpen,
  scored = true,
}: {
  hints: RenderedHints;
  used: number;
  disabled: boolean;
  onOpen(tier: number): void;
  scored?: boolean;
}) {
  const tiers = hintTiers(hints);
  const open = tiers.filter((t) => t.tier <= used);
  const next = tiers.find((t) => t.tier > used);
  if (disabled && open.length === 0) return null;
  return (
    <section
      aria-label="Hints"
      className="rounded-xl border border-border bg-surface p-3"
      data-testid="hints"
    >
      {open.length === 0 && (
        <p className="text-xs text-muted">
          Stuck? Hints get more specific each time.
          {scored ? ' Each one lowers this step’s score a little.' : ''}
        </p>
      )}
      <ol className="space-y-2" aria-live="polite">
        {open.map((t) => (
          <li key={t.tier} className="rounded-lg bg-accent-soft/60 px-3 py-2 text-sm">
            <div className="text-xs font-semibold text-accent">
              Hint {tiers.indexOf(t) + 1} · {t.title}
            </div>
            <Markdown>{t.text}</Markdown>
          </li>
        ))}
      </ol>
      {next && !disabled && (
        <button
          type="button"
          onClick={() => onOpen(next.tier)}
          className="mt-2 w-full rounded-lg border border-border px-3 py-2 text-sm font-medium text-accent hover:bg-accent-soft"
          data-testid="hint-button"
        >
          Show hint {tiers.indexOf(next) + 1} of {tiers.length}{' '}
          <span className="text-xs text-muted">(H)</span>
        </button>
      )}
    </section>
  );
}
