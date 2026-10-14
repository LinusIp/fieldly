import type { ReactNode } from 'react';
import { Markdown } from '../components/Markdown';
import { BulbIcon, LinkIcon, PlusIcon } from '../components/ui';

export interface RenderedHints {
  nudge: string;
  buildsOn: string | null;
  partial: string;
}

const TITLES: Record<number, { title: string; icon: ReactNode }> = {
  1: { title: 'Nudge', icon: <BulbIcon /> },
  2: { title: 'Look back', icon: <LinkIcon /> },
  3: { title: 'Half the work', icon: <PlusIcon /> },
};

/** Tiers on offer: `buildsOn` is skipped when there is nothing to build on (§2.5). */
export function hintTiers(h: RenderedHints): { tier: number; title: string; text: string }[] {
  const tiers = [{ tier: 1, title: TITLES[1].title, text: h.nudge }];
  if (h.buildsOn) tiers.push({ tier: 2, title: TITLES[2].title, text: h.buildsOn });
  tiers.push({ tier: 3, title: TITLES[3].title, text: h.partial });
  return tiers;
}

/** The next tier after `used`, or null when all are open. */
export function nextHintTier(h: RenderedHints, used: number): number | null {
  return hintTiers(h).find((x) => x.tier > used)?.tier ?? null;
}

/**
 * The hint ladder (§2.5, §10.5): "Nudge", "Look back" and "Half the work" buttons inside the
 * question card. Opening a tier opens the ones before it; an opened tier becomes a flat tint tile
 * and its text appears in a tint bubble underneath. On demand only.
 */
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
  if (disabled && open.length === 0) return null;
  return (
    <section aria-label="Hints" className="flex flex-col gap-3" data-testid="hints">
      <div className="flex flex-wrap gap-2.5">
        {tiers.map((t) => {
          const isOpen = t.tier <= used;
          return (
            <button
              key={t.tier}
              type="button"
              aria-expanded={isOpen}
              disabled={disabled && !isOpen}
              onClick={() => !isOpen && onOpen(t.tier)}
              className={`inline-flex min-h-[46px] items-center gap-2 rounded-md px-4 font-extrabold text-ink ${
                isOpen ? 'border-2 border-outline bg-surface-tint' : 'press press-s1 bg-surface'
              }`}
              data-testid={`hint-${t.tier}`}
            >
              {TITLES[t.tier].icon}
              {t.title}
            </button>
          );
        })}
      </div>
      {open.length === 0 && !disabled && (
        <p className="text-small font-semibold text-ink-2">
          Stuck? Each hint goes a little further{scored ? ' and lowers this step’s score a little' : ''}.
          Press H for the next one.
        </p>
      )}
      <div className="flex flex-col gap-2" aria-live="polite">
        {open.map((t) => (
          <div
            key={t.tier}
            className="self-start rounded-lg bg-surface-tint px-4 py-3 font-semibold"
            data-testid="hint-text"
          >
            <span className="sr-only">{t.title}: </span>
            <Markdown>{t.text}</Markdown>
          </div>
        ))}
      </div>
    </section>
  );
}
