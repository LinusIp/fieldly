import { useEffect, useState } from 'react';
import { Markdown } from '../components/Markdown';
import { CrossIcon, LinkIcon } from '../components/ui';
import type { FactEntry } from './attempt';

/**
 * "Your facts so far" on a wire (§10.5): a 5 px ink wire with node dots; facts the current
 * question uses are lifted (tint, violet outline, volt dot, "Used here"); the next empty slot is a
 * dashed card saying how to fill it.
 */
export function FactsWire({
  facts,
  used = [],
  nextSlot,
}: {
  facts: FactEntry[];
  used?: string[];
  nextSlot?: string;
}) {
  return (
    <div className="relative flex flex-col gap-3 pl-[26px]">
      <span aria-hidden="true" className="absolute top-2.5 bottom-7 left-2 w-[5px] rounded-[3px] bg-ink" />
      {facts.length === 0 && !nextSlot && (
        <p className="text-small font-semibold text-ink-2">Facts you establish appear here as you go.</p>
      )}
      {facts.map((f) => {
        const isUsed = used.includes(f.id);
        return (
          <div
            key={f.id}
            className={`relative rounded-lg px-3.5 py-3 ${
              isUsed
                ? 'border-[3px] border-primary bg-surface-tint shadow-linked'
                : 'border-2 border-outline bg-surface'
            }`}
            data-fact={f.id}
            data-used={isUsed || undefined}
          >
            <span
              aria-hidden="true"
              className={`absolute top-4 -left-[27px] h-5 w-5 rounded-full border-[3px] border-outline ${isUsed ? 'bg-volt' : 'bg-surface'}`}
            />
            <span
              className={`flex justify-between gap-2 text-[14px] font-extrabold ${isUsed ? 'text-primary-ink' : 'text-ink-2'}`}
            >
              <span>{f.label}</span>
              {isUsed && <span>Used here</span>}
            </span>
            <Markdown inline>{f.text}</Markdown>
          </div>
        );
      })}
      {nextSlot && (
        <div className="relative rounded-lg border-2 border-dashed border-ink-3 px-3.5 py-3 text-small font-semibold text-ink-2">
          <span
            aria-hidden="true"
            className="absolute top-3.5 -left-[26px] h-5 w-5 rounded-full border-[3px] border-dashed border-ink-3 bg-ground"
          />
          {nextSlot}
        </div>
      )}
    </div>
  );
}

export function FactsPanel(props: { facts: FactEntry[]; used?: string[]; nextSlot?: string }) {
  return (
    <section aria-labelledby="facts-h" className="flex flex-col gap-3" data-testid="facts">
      <h2 id="facts-h" className="text-h2">
        Your facts so far
      </h2>
      <FactsWire {...props} />
    </section>
  );
}

/**
 * On phones and explore screens the panel collapses to a button with a volt count badge, which
 * opens the facts in a bottom drawer (§10.2, §10.5).
 */
export function FactsButton({
  facts,
  used,
  nextSlot,
  className = '',
}: {
  facts: FactEntry[];
  used?: string[];
  nextSlot?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="facts-drawer"
        onClick={() => setOpen(true)}
        className={`press press-s1 flex min-h-[52px] w-full items-center justify-between gap-2.5 rounded-lg bg-surface px-4 font-extrabold text-ink ${className}`}
        data-testid="facts-button"
      >
        <span className="inline-flex items-center gap-2.5">
          <LinkIcon className="h-5 w-5" />
          Your facts so far
        </span>
        <span className="tabular rounded-full border-2 border-outline bg-volt px-2.5 py-0.5 text-on-fill">
          {facts.length}
        </span>
      </button>
      {open && (
        <div className="fixed inset-0 z-40 flex items-end bg-ink/40" onClick={() => setOpen(false)}>
          <div
            id="facts-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="facts-drawer-h"
            className="max-h-[75vh] w-full overflow-y-auto rounded-t-xl border-2 border-outline bg-ground p-5"
            onClick={(e) => e.stopPropagation()}
            data-testid="facts-drawer"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 id="facts-drawer-h" className="text-h2">
                Your facts so far
              </h2>
              <button
                type="button"
                aria-label="Close facts"
                className="press press-s1 flex h-11 w-11 items-center justify-center rounded-md bg-surface"
                onClick={() => setOpen(false)}
                autoFocus
              >
                <CrossIcon className="h-5 w-5" />
              </button>
            </div>
            <FactsWire facts={facts} used={used} nextSlot={nextSlot} />
          </div>
        </div>
      )}
    </>
  );
}
