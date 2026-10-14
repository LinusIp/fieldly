import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Markdown } from '../../components/Markdown';
import { Badge, Button, ErrorState, Loading, SettingsIcon } from '../../components/ui';
import { findLesson, loadSubject, useContentIndex } from '../../content/loader';
import { nsId, type SubjectContent } from '../../content/types';
import { recall } from '../../engine/memory';
import { needsReview, type MasteryLevel } from '../../engine/mastery';
import {
  downloadProgress,
  parseImport,
  summarizeProgress,
  type ImportSummary,
} from '../../storage/exportImport';
import { useProgress } from '../../storage/progress';
import type { Progress } from '../../storage/schema';

const LEVEL: Record<MasteryLevel, { label: string; tone: 'neutral' | 'accent' | 'ok' }> = {
  practised: { label: 'Practised', tone: 'neutral' },
  proficient: { label: 'Proficient', tone: 'accent' },
  mastered: { label: 'Mastered', tone: 'ok' },
};

export default function ProfilePage() {
  const { data: index, error } = useContentIndex();
  const progress = useProgress((s) => s.progress);
  const [subjects, setSubjects] = useState<Map<string, SubjectContent> | null>(null);

  useEffect(() => {
    if (!index) return;
    let alive = true;
    Promise.all(index.subjects.map((s) => loadSubject(s.id).then((c) => [s.id, c] as const))).then(
      (pairs) => alive && setSubjects(new Map(pairs)),
      () => alive && setSubjects(new Map()),
    );
    return () => {
      alive = false;
    };
  }, [index]);

  if (error) return <ErrorState error={error} />;
  if (!index || !subjects) return <Loading what="Loading your profile" />;

  const s = summarizeProgress(progress);
  const now = new Date();

  // Concept levels per subject (§3.4): shown only after ≥ 3 graded answers.
  const groups = index.subjects
    .map((subj) => {
      const content = subjects.get(subj.id);
      const rows = (content?.concepts ?? [])
        .map((c) => {
          const key = nsId(subj.id, c.id);
          const rating = progress.ratings.concept[key];
          const mem = progress.memory[key];
          return {
            id: key,
            title: c.title,
            n: rating?.n ?? 0,
            level: progress.mastery[key]?.level,
            review: mem ? needsReview(recall(mem, now)) : false,
          };
        })
        .filter((r) => r.n > 0);
      return { subj, rows };
    })
    .filter((g) => g.rows.length > 0);

  const misconceptions = Object.entries(progress.misconceptions)
    .sort((a, b) => b[1].count - a[1].count || b[1].lastSeen.localeCompare(a[1].lastSeen))
    .slice(0, 8)
    .map(([id, m]) => {
      const [sid, slug] = id.includes('/') ? id.split('/', 2) : ['', id];
      const content = subjects.get(sid);
      const found = content?.misconceptions.find((x) => x.id === slug);
      return { id, ...m, info: found };
    });

  return (
    <div className="mx-auto max-w-[1000px] space-y-6 px-[18px] py-6 md:px-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-[30px] leading-[1.05] font-extrabold tracking-[-0.02em] md:text-display">
          Your progress
        </h1>
        <Link
          to="/settings"
          className="press press-s1 inline-flex min-h-[48px] items-center gap-2 rounded-md bg-surface px-4 font-extrabold text-ink no-underline"
        >
          <SettingsIcon />
          Settings
        </Link>
      </header>

      <section aria-label="Totals" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Lessons completed', s.lessonsCompleted],
          ['Stars', s.stars],
          ['Questions answered', s.questionsAnswered],
          ['XP', s.xp],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border-2 border-outline bg-surface p-4">
            <div className="text-2xl font-semibold">{value}</div>
            <div className="text-xs text-ink-2">{label}</div>
          </div>
        ))}
      </section>

      <section className="rounded-xl border-2 border-outline bg-surface p-5">
        <h2 className="font-semibold">Concepts</h2>
        <p className="text-sm text-ink-2">
          A level appears after 3 graded answers: Practised → Proficient → Mastered. “Needs review” means it's
          time to practise it again.
        </p>
        {groups.length === 0 && (
          <p className="mt-3 text-sm text-ink-2">Answer some questions to see your concepts here.</p>
        )}
        {groups.map(({ subj, rows }) => (
          <div key={subj.id} className="mt-4">
            <h3 className="text-h3 text-ink">{subj.title}</h3>
            <ul className="mt-2 space-y-2" data-testid={`concepts-${subj.id}`}>
              {rows.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>{c.title}</span>
                  <span className="flex gap-2">
                    {c.review && <Badge tone="warn">Needs review</Badge>}
                    {c.level ? (
                      <Badge tone={LEVEL[c.level].tone}>{LEVEL[c.level].label}</Badge>
                    ) : (
                      <span className="text-xs text-ink-2">{Math.min(c.n, 3)} of 3 answers</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="rounded-xl border-2 border-outline bg-surface p-5">
        <h2 className="font-semibold">Misconceptions you've met most</h2>
        {misconceptions.length === 0 ? (
          <p className="mt-1 text-sm text-ink-2">None yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {misconceptions.map((m) => (
              <li key={m.id} className="rounded-lg bg-surface-sunk p-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">
                    <Markdown inline>{m.info?.name ?? m.info?.short ?? m.id}</Markdown>
                  </span>
                  <span className="text-xs text-ink-2">
                    met {m.count} time{m.count === 1 ? '' : 's'}, last on{' '}
                    {new Date(m.lastSeen).toLocaleDateString()}
                  </span>
                </div>
                {m.info && (
                  <div className="mt-1 text-ink-2">
                    <Markdown>{m.info.explain}</Markdown>
                  </div>
                )}
                {m.info && m.info.lessons.length > 0 && (
                  <div className="mt-2 text-xs">
                    Revisit:{' '}
                    {m.info.lessons.map((l, i) => {
                      const loc = findLesson(index, l);
                      return (
                        <span key={l}>
                          {i > 0 && ', '}
                          <Link to={`/l/${l}`} className="text-primary-ink underline">
                            {loc?.lesson.title ?? l}
                          </Link>
                          {loc && !loc.lesson.available && ' (coming soon)'}
                        </span>
                      );
                    })}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <BackupSection progress={progress} />
    </div>
  );
}

function BackupSection({ progress }: { progress: Progress }) {
  const replace = useProgress((s) => s.replace);
  const reset = useProgress((s) => s.reset);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ progress: Progress; summary: ImportSummary } | null>(null);
  const [message, setMessage] = useState('');
  const [confirmText, setConfirmText] = useState('');

  const onFile = async (file: File) => {
    const r = parseImport(await file.text());
    if (r.ok) {
      setPending({ progress: r.progress, summary: r.summary });
      setMessage('');
    } else {
      setPending(null);
      setMessage(r.error);
    }
  };

  return (
    <section className="rounded-xl border-2 border-outline bg-surface p-5" aria-labelledby="backup-h">
      <h2 id="backup-h" className="font-semibold">
        Back up, restore or reset
      </h2>
      <p className="text-sm text-ink-2">
        Your progress lives only in this browser. Export it to keep a copy or move it to another device.
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <Button onClick={() => downloadProgress(progress)} data-testid="export">
          Export progress
        </Button>
        <Button variant="secondary" onClick={() => fileRef.current?.click()} data-testid="import">
          Import progress…
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          data-testid="import-file"
          aria-label="Choose a progress file to import"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
            e.target.value = '';
          }}
        />
      </div>

      <div aria-live="polite">
        {message && <p className="mt-3 rounded-lg bg-wrong-tint px-3 py-2 text-sm text-ink">{message}</p>}
        {pending && (
          <div
            className="mt-3 rounded-lg border-2 border-outline bg-surface-sunk p-4 text-sm"
            data-testid="import-summary"
          >
            <p className="font-semibold">Replace your current progress with this file?</p>
            <ul className="mt-1 list-disc pl-5 text-ink-2">
              <li>Started {new Date(pending.summary.createdAt).toLocaleDateString()}</li>
              <li>
                {pending.summary.lessonsCompleted} lessons completed ({pending.summary.stars} stars),{' '}
                {pending.summary.lessonsStarted} started
              </li>
              <li>{pending.summary.questionsAnswered} questions answered</li>
              <li>{pending.summary.xp} XP</li>
            </ul>
            <div className="mt-3 flex gap-3">
              <Button
                onClick={() => {
                  replace(pending.progress);
                  setPending(null);
                  setMessage('');
                }}
                data-testid="import-confirm"
              >
                Replace my progress
              </Button>
              <Button variant="secondary" onClick={() => setPending(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      <details className="mt-5">
        <summary className="cursor-pointer text-sm font-semibold text-ink">Reset all progress…</summary>
        <div className="mt-3 space-y-2 text-sm">
          <p>
            This deletes every rating, star, answer and puzzle result in this browser. It can't be undone.
          </p>
          <label className="block">
            Type <strong>RESET</strong> to confirm:
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="ml-2 rounded border-2 border-outline bg-surface px-2 py-1"
              data-testid="reset-input"
            />
          </label>
          <Button
            variant="danger"
            disabled={confirmText !== 'RESET'}
            onClick={() => {
              reset();
              setConfirmText('');
            }}
            data-testid="reset"
          >
            Reset progress
          </Button>
        </div>
      </details>
    </section>
  );
}
