import { useState } from 'react';
import { Markdown } from '../components/Markdown';

function FactsList({ facts }: { facts: string[] }) {
  if (facts.length === 0)
    return <p className="text-sm text-muted">Facts you establish appear here as you go.</p>;
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

/** The Facts panel (§2.4): beside the main column on desktop… */
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

/** …and a bottom drawer on mobile. */
export function FactsDrawer({ facts }: { facts: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface shadow-[0_-4px_16px_rgba(0,0,0,0.08)] lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="facts-drawer"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-[44px] w-full items-center justify-between px-4 py-3 text-sm font-semibold"
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

export interface Dot {
  id: string;
  label: string;
  /** Graded result 0–1, if any. */
  score?: number;
  /** Visited (for screens without a score). */
  visited: boolean;
  current: boolean;
  skipped?: boolean;
}

function tone(score: number): { cls: string; word: string; mark: string } {
  if (score >= 0.8) return { cls: 'bg-ok border-ok text-bg', word: 'strong', mark: '✓' };
  if (score > 0) return { cls: 'bg-warn border-warn text-bg', word: 'right, with help', mark: '~' };
  return { cls: 'bg-bad border-bad text-bg', word: 'missed', mark: '✕' };
}

/** A slim progress bar of every screen, dots coloured by result — with a mark and text, not colour alone. */
export function ProgressDots({ dots, onPick }: { dots: Dot[]; onPick(i: number): void }) {
  return (
    <ol
      className="flex flex-wrap items-center gap-1"
      aria-label="Lesson progress"
      data-testid="progress-dots"
    >
      {dots.map((d, i) => {
        let cls = 'border-border bg-surface';
        let mark = '';
        let desc = d.visited ? 'done' : 'not reached yet';
        if (d.skipped) {
          cls = 'border-dashed border-border';
          mark = '–';
          desc = 'skipped';
        } else if (d.score !== undefined) {
          const t = tone(d.score);
          cls = t.cls;
          mark = t.mark;
          desc = `${t.word}, score ${d.score}`;
        } else if (d.visited) cls = 'border-accent bg-accent-soft';
        if (d.current) desc = `${desc} (current)`;
        const canPick = d.visited && !d.current;
        return (
          <li key={d.id}>
            <button
              type="button"
              disabled={!canPick}
              onClick={() => onPick(i)}
              className={`flex h-5 min-w-5 items-center justify-center rounded-full border-2 px-0.5 text-[10px] font-bold ${cls} ${d.current ? 'ring-2 ring-accent ring-offset-1 ring-offset-bg' : ''} ${canPick ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
              aria-label={`${d.label}: ${desc}`}
              data-dot={d.id}
            >
              <span aria-hidden="true">{mark}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
