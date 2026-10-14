export interface DotInfo {
  id: string;
  label: string;
  score?: number;
  skipped?: boolean;
  current: boolean;
}

function tone(score: number): { cls: string; word: string; mark: string } {
  if (score >= 0.8) return { cls: 'bg-ok text-bg border-ok', word: 'strong', mark: '✓' };
  if (score > 0) return { cls: 'bg-warn text-bg border-warn', word: 'right, with help', mark: '~' };
  return { cls: 'bg-bad text-bg border-bad', word: 'missed', mark: '✕' };
}

/** Completed / current / remaining steps, coloured by score — with a mark and text, not colour alone. */
export function ProgressDots({ dots }: { dots: DotInfo[] }) {
  return (
    <section aria-labelledby="progress-h" className="rounded-xl border border-border bg-surface p-4">
      <h2 id="progress-h" className="mb-2 text-sm font-semibold">
        Progress
      </h2>
      <ol className="flex flex-wrap gap-2" data-testid="progress-dots">
        {dots.map((d) => {
          let cls = 'border-border text-muted';
          let mark = '';
          let desc = 'not answered yet';
          if (d.skipped) {
            cls = 'border-dashed border-border text-muted';
            mark = '–';
            desc = 'skipped';
          } else if (d.score !== undefined) {
            const t = tone(d.score);
            cls = t.cls;
            mark = t.mark;
            desc = `${t.word}, score ${d.score}`;
          }
          if (d.current) desc = d.score === undefined ? 'current question' : `${desc} (current)`;
          return (
            <li key={d.id} className="flex flex-col items-center gap-0.5">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold ${cls} ${
                  d.current ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : ''
                }`}
                aria-hidden="true"
              >
                {mark}
              </span>
              <span className="text-[10px] font-medium text-muted" aria-hidden="true">
                {d.label.replace('Extra practice', 'Extra')}
              </span>
              <span className="sr-only">
                {d.label}: {desc}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
