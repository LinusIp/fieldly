/** Browser-side test runner: workers, timeouts, comparison. */
import { compareOutput, preview } from './compare';
import { generate } from './generators';
import type { RawRun } from './harness';
import type { Config, Lang, RunResults, TestOutcome } from './logic';

let jsWorker: Worker | null = null;
let pyWorker: Worker | null = null;
let pyReady: Promise<void> | null = null;

function getJsWorker(): Worker {
  jsWorker ??= new Worker(new URL('./js-worker.ts', import.meta.url), { type: 'module' });
  return jsWorker;
}

function killJs() {
  jsWorker?.terminate();
  jsWorker = null;
}

function getPyWorker(onStatus: (s: string) => void): Promise<Worker> {
  if (!pyWorker) {
    pyWorker = new Worker(new URL('./py-worker.ts', import.meta.url), { type: 'module' });
    const w = pyWorker;
    onStatus('Loading Python (about 10 MB, first time only)…');
    pyReady = new Promise<void>((resolve, reject) => {
      const onMsg = (e: MessageEvent<{ type: string; data?: unknown }>) => {
        if (e.data.type === 'ready') {
          w.removeEventListener('message', onMsg);
          resolve();
        } else if (e.data.type === 'result') {
          w.removeEventListener('message', onMsg);
          reject(new Error(String((e.data.data as { error?: string })?.error ?? 'Python failed to load')));
        }
      };
      w.addEventListener('message', onMsg);
      w.postMessage({ type: 'warm' });
    });
  }
  const w = pyWorker;
  return pyReady!.then(() => w);
}

function killPy() {
  pyWorker?.terminate();
  pyWorker = null;
  pyReady = null;
}

/** Run once in the worker for `lang`; resolves null on timeout (the worker is restarted). */
async function runOnce(
  lang: Lang,
  code: string,
  entry: string,
  argsList: unknown[][],
  timeoutMs: number,
  onStatus: (s: string) => void,
): Promise<RawRun | null> {
  const worker = lang === 'javascript' ? getJsWorker() : await getPyWorker(onStatus);
  onStatus('Running tests…');
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      worker.removeEventListener('message', onMsg);
      if (lang === 'javascript') killJs();
      else killPy();
      resolve(null);
    }, timeoutMs);
    const onMsg = (e: MessageEvent) => {
      clearTimeout(timer);
      worker.removeEventListener('message', onMsg);
      const data = lang === 'javascript' ? e.data : e.data?.data;
      resolve(data as RawRun);
    };
    worker.addEventListener('message', onMsg);
    worker.postMessage(
      lang === 'javascript' ? { code, entry, argsList } : { type: 'run', code, entry, argsList },
    );
  });
}

export async function runTests(
  lang: Lang,
  code: string,
  config: Config,
  onStatus: (s: string) => void = () => {},
): Promise<RunResults> {
  const entry = config.entry[lang];
  const base: RunResults = {
    lang,
    code,
    passed: 0,
    total: config.tests.length,
    perfPassed: config.perf ? false : null,
    perfMs: null,
    timeMs: 0,
    tests: [],
  };

  let raw: RawRun | null;
  try {
    raw = await runOnce(
      lang,
      code,
      entry,
      config.tests.map((t) => t.args),
      config.timeoutMs,
      onStatus,
    );
  } catch (e) {
    return { ...base, error: (e as Error).message };
  }
  if (raw === null)
    return {
      ...base,
      error: `Stopped after ${config.timeoutMs / 1000} s — is there an infinite loop?`,
      tests: config.tests.map((t, i) => ({
        name: t.name ?? `Test ${i + 1}`,
        hidden: !!t.hidden,
        ok: false,
        error: 'not run',
      })),
    };
  if (!Array.isArray(raw)) return { ...base, error: raw.error };

  const tests: TestOutcome[] = config.tests.map((t, i) => {
    const r = raw[i];
    const ok = !!r?.ok && compareOutput(r.value, t.expected, config.comparator);
    const out: TestOutcome = { name: t.name ?? `Test ${i + 1}`, hidden: !!t.hidden, ok };
    if (!t.hidden) {
      out.args = preview(t.args);
      out.expected = preview(t.expected);
      if (r?.ok) out.got = preview(r.value);
      else out.error = r?.error ?? 'no result';
    } else if (!r?.ok) out.error = 'raised an error';
    return out;
  });
  const passed = tests.filter((t) => t.ok).length;
  const timeMs = raw.reduce((a, r) => a + (r?.ms ?? 0), 0);

  let perfPassed: boolean | null = null;
  let perfMs: number | null = null;
  if (config.perf) {
    perfPassed = false;
    if (passed === tests.length) {
      const c = generate(config.perf.generator, config.perf.params);
      onStatus('Running the performance test…');
      const limit = config.perf.timeLimitMs;
      const pr = await runOnce(lang, code, entry, [c.args], Math.max(limit * 3, 1500), onStatus).catch(
        () => null,
      );
      if (pr && Array.isArray(pr) && pr[0]?.ok) {
        perfMs = pr[0].ms;
        perfPassed = compareOutput(pr[0].value, c.expected, config.comparator) && pr[0].ms <= limit;
      }
    }
  }
  onStatus('');
  return { ...base, passed, tests, timeMs, perfPassed, perfMs };
}
