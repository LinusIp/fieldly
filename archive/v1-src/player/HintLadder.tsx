import { Markdown } from '../components/Markdown';

export interface RenderedHints {
  nudge: string;
  buildsOn: string | null;
  partial: string;
}

/** Tiers available for a question: buildsOn is skipped when there is nothing to build on. */
export function hintTiers(h: RenderedHints): { tier: number; title: string; text: string }[] {
  const tiers = [{ tier: 1, title: 'Nudge', text: h.nudge }];
  if (h.buildsOn) tiers.push({ tier: 2, title: 'Builds on', text: h.buildsOn });
  tiers.push({ tier: 3, title: 'Partial solution', text: h.partial });
  return tiers;
}

/** Next tier number after `used`, or null when all are open. */
export function nextHintTier(h: RenderedHints, used: number): number | null {
  const t = hintTiers(h).find((x) => x.tier > used);
  return t ? t.tier : null;
}

export function HintLadder({
  hints,
  used,
  disabled,
  onOpen,
}: {
  hints: RenderedHints;
  used: number;
  disabled: boolean;
  onOpen(tier: number): void;
}) {
  const tiers = hintTiers(hints);
  const open = tiers.filter((t) => t.tier <= used);
  const next = tiers.find((t) => t.tier > used);
  return (
    <section aria-labelledby="hints-h" className="rounded-xl border border-border bg-surface p-4">
      <h2 id="hints-h" className="text-sm font-semibold">
        Hints
      </h2>
      {open.length === 0 && (
        <p className="mt-1 text-xs text-muted">
          Stuck? Hints get more specific each time. Each one lowers this step's score a little.
        </p>
      )}
      <ol className="mt-2 space-y-2">
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
          className="mt-3 w-full rounded-lg border border-border px-3 py-2 text-sm font-medium text-accent hover:bg-accent-soft"
        >
          Show hint {tiers.indexOf(next) + 1} <span className="text-xs text-muted">(H)</span>
        </button>
      )}
    </section>
  );
}
