/**
 * Validate content, then emit public/content/index.json and public/content/<subjectId>.json.
 * `--watch` rebuilds on every change under content/ (used by `npm run dev`).
 */
import { mkdirSync, rmSync, watch, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { printIssues, summarize, validateContent } from './validate-content';

const ROOT = resolve(import.meta.dirname, '..');
const CONTENT = join(ROOT, 'content');
const OUT = join(ROOT, 'public', 'content');

/** Returns true on success. */
export function buildContent(opts: { failOnError: boolean } = { failOnError: true }): boolean {
  const t0 = performance.now();
  const result = validateContent(CONTENT);
  printIssues(result);
  if (result.errors.length && opts.failOnError) {
    console.log(`\ncontent:build — ${result.errors.length} error(s); nothing written.`);
    return false;
  }
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'index.json'), JSON.stringify(result.index));
  for (const [id, subject] of Object.entries(result.subjects)) {
    writeFileSync(join(OUT, `${id}.json`), JSON.stringify(subject));
  }
  const ms = Math.round(performance.now() - t0);
  console.log(
    `content:build — ${summarize(result)}; ${result.errors.length} errors, ${result.warnings.length} warnings (${ms} ms).`,
  );
  return result.errors.length === 0;
}

export function watchContent(): void {
  let timer: NodeJS.Timeout | undefined;
  watch(CONTENT, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        buildContent({ failOnError: false });
      } catch (e) {
        console.error(e);
      }
    }, 150);
  });
  console.log('content:build — watching content/ for changes');
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const watchMode = process.argv.includes('--watch');
  const ok = buildContent({ failOnError: !watchMode });
  if (watchMode) watchContent();
  else process.exit(ok ? 0 : 1);
}
