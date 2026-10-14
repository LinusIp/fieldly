/**
 * Validate content, then emit public/content/index.json and public/content/<subjectId>.json.
 * `--watch` rebuilds on every change under content/ — and under the validator and challenge code
 * it runs (used by `npm run dev`). `--lenient` writes the output even when there are errors.
 */
import { spawn, type ChildProcess } from 'node:child_process';
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

/**
 * Rebuild on changes. Each rebuild runs in a fresh process, so edits to the validator or to
 * challenge logic take effect without restarting the dev server (an in-process build would keep
 * the modules it loaded first).
 */
export function watchContent(): void {
  const dirs = [
    CONTENT,
    join(ROOT, 'scripts'),
    join(ROOT, 'src', 'interactives'),
    join(ROOT, 'src', 'widgets'),
    join(ROOT, 'src', 'engine'),
    join(ROOT, 'src', 'content'),
  ];
  const tsx = join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  let timer: NodeJS.Timeout | undefined;
  let running: ChildProcess | null = null;
  let again = false;
  const run = () => {
    if (running) {
      again = true;
      return;
    }
    running = spawn(process.execPath, [tsx, join(ROOT, 'scripts', 'build-content.ts'), '--lenient'], {
      stdio: 'inherit',
      cwd: ROOT,
    });
    running.on('exit', () => {
      running = null;
      if (again) {
        again = false;
        run();
      }
    });
  };
  for (const dir of dirs)
    watch(dir, { recursive: true }, () => {
      clearTimeout(timer);
      timer = setTimeout(run, 150);
    });
  console.log('content:build — watching content/ and the validator/challenge code for changes');
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const watchMode = process.argv.includes('--watch');
  const lenient = watchMode || process.argv.includes('--lenient');
  const ok = buildContent({ failOnError: !lenient });
  if (watchMode) watchContent();
  else process.exit(ok || lenient ? 0 : 1);
}
