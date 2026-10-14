/// <reference lib="webworker" />
import { runJsTests } from './harness';

/** Runs the student's JavaScript off the main thread; the page terminates it on timeout. */
self.onmessage = (e: MessageEvent<{ code: string; entry: string; argsList: unknown[][] }>) => {
  const { code, entry, argsList } = e.data;
  const result = runJsTests(code, entry, argsList, () => performance.now());
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(result);
};
