import { APP_KEY } from '../config';
import { migrate } from './migrations';
import type { Progress } from './schema';

/** File name for an export, e.g. fieldly-progress-2026-10-14.json. */
export function exportFileName(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${APP_KEY.replace(/:$/, '')}-progress-${y}-${m}-${d}.json`;
}

export function serializeProgress(p: Progress): string {
  return JSON.stringify(p, null, 2);
}

export interface ImportSummary {
  createdAt: string;
  lessonsStarted: number;
  lessonsCompleted: number;
  stars: number;
  questionsAnswered: number;
  reviewItems: number;
}

export function summarizeProgress(p: Progress): ImportSummary {
  const lessons = Object.values(p.lessons);
  return {
    createdAt: p.createdAt,
    lessonsStarted: lessons.filter((l) => l.status !== 'not-started').length,
    lessonsCompleted: lessons.filter((l) => l.status === 'completed').length,
    stars: lessons.reduce((a, l) => a + l.stars, 0),
    questionsAnswered: Object.values(p.questions).reduce((a, q) => a + q.attempts, 0),
    reviewItems: Object.keys(p.review).length,
  };
}

export type ParseResult =
  { ok: true; progress: Progress; summary: ImportSummary } | { ok: false; error: string };

/** Parse and validate an exported file (migrating older versions). */
export function parseImport(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' };
  }
  try {
    const progress = migrate(raw);
    return { ok: true, progress, summary: summarizeProgress(progress) };
  } catch (e) {
    return {
      ok: false,
      error: `That file isn't a ${APP_KEY.replace(/:$/, '')} progress export: ${(e as Error).message}`,
    };
  }
}

/** Trigger a browser download of the progress file. */
export function downloadProgress(p: Progress): void {
  const blob = new Blob([serializeProgress(p)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exportFileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
