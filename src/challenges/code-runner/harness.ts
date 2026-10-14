/**
 * Test harnesses shared by the browser workers and the Node validator.
 * Both return, per test: { ok, value?, error?, ms }.
 */

export interface RawTestResult {
  ok: boolean;
  value?: unknown;
  error?: string;
  ms: number;
}

export type RawRun = { error: string } | RawTestResult[];

/** Defines `__fieldly_run(code, entry, tests_json) -> json` in Python. */
export const PY_HARNESS = `
import json as __json, time as __time, traceback as __tb

def __fieldly_err(e):
    return "".join(__tb.format_exception_only(type(e), e)).strip()

def __fieldly_run(code, entry, tests_json):
    ns = {"__name__": "solution"}
    try:
        exec(code, ns)
    except BaseException as e:
        return __json.dumps({"error": __fieldly_err(e)})
    fn = ns.get(entry)
    if not callable(fn):
        return __json.dumps({"error": "No function named " + entry + " was defined."})
    out = []
    for args in __json.loads(tests_json):
        t0 = __time.perf_counter()
        try:
            value = fn(*args)
            out.append({"ok": True, "value": value, "ms": (__time.perf_counter() - t0) * 1000})
        except BaseException as e:
            out.append({"ok": False, "error": __fieldly_err(e), "ms": (__time.perf_counter() - t0) * 1000})
    return __json.dumps(out, default=lambda o: list(o) if isinstance(o, (set, frozenset, tuple)) else str(o))
`;

/** Run JavaScript tests in the current realm (used inside the worker). */
export function runJsTests(code: string, entry: string, argsList: unknown[][], now: () => number): RawRun {
  let fn: unknown;
  try {
    fn = new Function(
      `"use strict";\n${code}\n;return typeof ${entry} === "function" ? ${entry} : undefined;`,
    )();
  } catch (e) {
    return { error: String((e as Error)?.message ?? e) };
  }
  if (typeof fn !== 'function') return { error: `No function named ${entry} was defined.` };
  const out: RawTestResult[] = [];
  for (const args of argsList) {
    const copy = JSON.parse(JSON.stringify(args)) as unknown[];
    const t0 = now();
    try {
      const value = (fn as (...a: unknown[]) => unknown)(...copy);
      out.push({
        ok: true,
        value: value === undefined ? null : JSON.parse(JSON.stringify(value)),
        ms: now() - t0,
      });
    } catch (e) {
      out.push({ ok: false, error: String((e as Error)?.message ?? e), ms: now() - t0 });
    }
  }
  return out;
}
