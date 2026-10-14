/// <reference lib="webworker" />
import { PYODIDE_URL } from '../../config';
import { PY_HARNESS } from './harness';

/** Runs Python through Pyodide (loaded from the CDN on first use) off the main thread. */

interface PyodideLike {
  runPython(code: string): unknown;
  globals: { get(name: string): (...args: unknown[]) => unknown };
}

let pyodide: Promise<PyodideLike> | null = null;

function load(): Promise<PyodideLike> {
  pyodide ??= import(/* @vite-ignore */ `${PYODIDE_URL}pyodide.mjs`)
    .then((m: { loadPyodide(o: { indexURL: string }): Promise<PyodideLike> }) =>
      m.loadPyodide({ indexURL: PYODIDE_URL }),
    )
    .then((py) => {
      py.runPython(PY_HARNESS);
      return py;
    });
  return pyodide;
}

const post = (msg: unknown) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg);

self.onmessage = async (
  e: MessageEvent<{ type: 'warm' } | { type: 'run'; code: string; entry: string; argsList: unknown[][] }>,
) => {
  try {
    const py = await load();
    if (e.data.type === 'warm') {
      post({ type: 'ready' });
      return;
    }
    const run = py.globals.get('__fieldly_run');
    const out = run(e.data.code, e.data.entry, JSON.stringify(e.data.argsList)) as string;
    post({ type: 'result', data: JSON.parse(out) });
  } catch (err) {
    post({
      type: 'result',
      data: { error: `Python could not run: ${String((err as Error)?.message ?? err)}` },
    });
  }
};
