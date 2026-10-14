import { useState } from 'react';
import { Markdown } from '../components/Markdown';

function FactsList({ facts }: { facts: string[] }) {
  if (facts.length === 0)
    return <p className="text-sm text-muted">Facts you establish appear here as you answer.</p>;
  return (
    <ol className="space-y-2">
      {facts.map((f, i) => (
        <li key={i} className="flex gap-2 text-sm">
          <span aria-hidden="true" className="mt-0.5 text-accent">
            ●
          </span>
          <Markdown inline>{f}</Markdown>
        </li>
      ))}
    </ol>
  );
}

/** Desktop: a sidebar card. */
export function FactsPanel({ facts }: { facts: string[] }) {
  return (
    <section
      aria-labelledby="facts-h"
      className="rounded-xl border border-border bg-surface p-4"
      data-testid="facts"
    >
      <h2 id="facts-h" className="mb-2 text-sm font-semibold">
        Facts so far
      </h2>
      <FactsList facts={facts} />
    </section>
  );
}

/** Mobile: a collapsible drawer pinned to the bottom of the screen. */
export function FactsDrawer({ facts }: { facts: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface shadow-[0_-4px_16px_rgba(0,0,0,0.08)] lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="facts-drawer"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold"
      >
        <span>Facts so far ({facts.length})</span>
        <span aria-hidden="true">{open ? '▾' : '▴'}</span>
      </button>
      {open && (
        <div id="facts-drawer" className="max-h-[45vh] overflow-y-auto px-4 pb-4">
          <FactsList facts={facts} />
        </div>
      )}
    </div>
  );
}
