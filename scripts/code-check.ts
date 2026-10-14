/**
 * Validator support for code-runner challenges (§9.2): runs every reference solution against its
 * tests and performance case — JavaScript in node:vm, Python in a python3 subprocess (or, when
 * python3 is unavailable, Pyodide in Node; a warning is printed). Python jobs are batched.
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import vm from 'node:vm';
import { compareOutput, preview } from '../src/challenges/code-runner/compare';
import { generate } from '../src/challenges/code-runner/generators';
import { PY_HARNESS, type RawRun } from '../src/challenges/code-runner/harness';
import type { RawConfig, Solution } from '../src/challenges/code-runner/logic';

export interface CodeIssue {
  level: 'error' | 'warning';
  message: string;
}

type Report = (issue: CodeIssue) => void;

interface PyJob {
  code: string;
  entry: string;
  argsList: unknown[][];
  done(run: RawRun | null, engine: 'python3' | 'pyodide' | 'none'): void;
}

const pyQueue: PyJob[] = [];

function runJs(code: string, entry: string, argsList: unknown[][], timeoutMs: number): RawRun {
  const ctx = vm.createContext({});
  try {
    vm.runInContext(
      `${code}\n;globalThis.__fn = typeof ${entry} === "function" ? ${entry} : undefined;`,
      ctx,
      {
        timeout: timeoutMs,
      },
    );
  } catch (e) {
    return { error: String((e as Error).message) };
  }
  if (typeof (ctx as { __fn?: unknown }).__fn !== 'function')
    return { error: `No function named ${entry} was defined.` };
  return argsList.map((args) => {
    (ctx as Record<string, unknown>).__args = JSON.parse(JSON.stringify(args));
    const t0 = performance.now();
    try {
      const value = vm.runInContext('JSON.stringify(__fn(...__args) ?? null)', ctx, { timeout: timeoutMs });
      return { ok: true, value: JSON.parse(value as string), ms: performance.now() - t0 };
    } catch (e) {
      return { ok: false, error: String((e as Error).message), ms: performance.now() - t0 };
    }
  });
}

function checkRun(
  lang: string,
  run: RawRun | null,
  config: RawConfig,
  report: Report,
  perfCase: { expected: unknown } | null,
  perfIsWarning: boolean,
) {
  if (run === null) return;
  if (!Array.isArray(run)) {
    report({ level: 'error', message: `${lang} reference solution failed to load: ${run.error}` });
    return;
  }
  config.tests.forEach((t, i) => {
    const r = run[i];
    if (!r?.ok)
      report({ level: 'error', message: `${lang} reference solution raised on test ${i + 1}: ${r?.error}` });
    else if (!compareOutput(r.value, t.expected, config.comparator))
      report({
        level: 'error',
        message: `${lang} reference solution fails test ${i + 1}: got ${preview(r.value)}, expected ${preview(t.expected)}`,
      });
  });
  if (config.perf && perfCase) {
    const r = run[config.tests.length];
    const level = perfIsWarning ? 'warning' : 'error';
    if (!r?.ok)
      report({
        level: 'error',
        message: `${lang} reference solution raised on the performance test: ${r?.error}`,
      });
    else if (!compareOutput(r.value, perfCase.expected, config.comparator))
      report({ level: 'error', message: `${lang} reference solution is wrong on the performance test` });
    else if (r.ms > config.perf.timeLimitMs)
      report({
        level,
        message: `${lang} reference solution took ${Math.round(r.ms)} ms on the performance test (limit ${config.perf.timeLimitMs} ms)`,
      });
  }
}

/** Check one challenge variant: JS now, Python queued for the batch. */
export function runCodeChecks(rawConfig: unknown, rawSolution: unknown, report: Report): void {
  const config = rawConfig as RawConfig;
  const solution = rawSolution as Solution;
  const perfCase = config.perf ? generate(config.perf.generator, config.perf.params) : null;
  const argsList = [...config.tests.map((t) => t.args), ...(perfCase ? [perfCase.args] : [])];

  checkRun(
    'JavaScript',
    runJs(solution.javascript, config.entry.javascript, argsList, 10_000),
    config,
    report,
    perfCase,
    false,
  );

  // The starter code should not already pass everything.
  const starter = runJs(
    config.starter.javascript,
    config.entry.javascript,
    config.tests.map((t) => t.args),
    2000,
  );
  if (
    Array.isArray(starter) &&
    config.tests.every(
      (t, i) => starter[i]?.ok && compareOutput(starter[i].value, t.expected, config.comparator),
    )
  )
    report({ level: 'warning', message: 'the JavaScript starter code already passes every test' });

  pyQueue.push({
    code: solution.python,
    entry: config.entry.python,
    argsList,
    done: (run, engine) => {
      if (engine === 'none') {
        report({
          level: 'warning',
          message: 'python3 and Pyodide are unavailable; Python reference solution not checked',
        });
        return;
      }
      checkRun('Python', run, config, report, perfCase, engine === 'pyodide');
    },
  });
}

function findPython(): string | null {
  for (const cmd of ['python3', 'python']) {
    const r = spawnSync(cmd, ['-c', 'import sys; print(sys.version_info[0])'], {
      encoding: 'utf8',
      timeout: 10_000,
    });
    if (r.status === 0 && r.stdout.trim() === '3') return cmd;
  }
  return null;
}

let warnedPyodide = false;

/** Run all queued Python jobs in one subprocess. Returns a note about the engine used. */
export function flushCodeChecks(): string | null {
  if (pyQueue.length === 0) return null;
  const jobs = pyQueue.splice(0);
  const py = findPython();
  if (py) {
    const script = `${PY_HARNESS}\nimport sys, json\njobs = json.loads(sys.stdin.read())\nprint(json.dumps([json.loads(__fieldly_run(j["code"], j["entry"], json.dumps(j["argsList"]))) for j in jobs]))`;
    const r = spawnSync(py, ['-c', script], {
      input: JSON.stringify(jobs.map(({ code, entry, argsList }) => ({ code, entry, argsList }))),
      encoding: 'utf8',
      // Without this, Windows Python decodes stdin in the ANSI code page and mangles non-ASCII test strings.
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      timeout: 300_000,
      maxBuffer: 256 * 1024 * 1024,
    });
    if (r.status === 0) {
      const runs = JSON.parse(r.stdout) as RawRun[];
      jobs.forEach((j, i) => j.done(runs[i], 'python3'));
      return null;
    }
    jobs.forEach((j) => j.done({ error: `python3 failed: ${r.stderr.slice(0, 400)}` }, 'python3'));
    return null;
  }
  const r = spawnSync(process.execPath, [join(import.meta.dirname, 'pyodide-run.mjs')], {
    input: JSON.stringify({
      harness: PY_HARNESS,
      jobs: jobs.map(({ code, entry, argsList }) => ({ code, entry, argsList })),
    }),
    encoding: 'utf8',
    timeout: 600_000,
    maxBuffer: 256 * 1024 * 1024,
    cwd: join(import.meta.dirname, '..'),
  });
  if (r.status !== 0) {
    jobs.forEach((j) => j.done(null, 'none'));
    return `Pyodide failed: ${r.stderr.slice(0, 300)}`;
  }
  const runs = JSON.parse(r.stdout) as RawRun[];
  jobs.forEach((j, i) => j.done(runs[i], 'pyodide'));
  if (!warnedPyodide) {
    warnedPyodide = true;
    return 'python3 not found — Python reference solutions were checked with Pyodide (timings are advisory).';
  }
  return null;
}
