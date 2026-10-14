// Runs a batch of Python jobs with Pyodide in Node (used by the validator when python3 is missing).
// stdin: { harness, jobs: [{ code, entry, argsList }] }  →  stdout: JSON array of harness results.
import { loadPyodide } from 'pyodide';

let input = '';
for await (const chunk of process.stdin) input += chunk;
const { harness, jobs } = JSON.parse(input);
const py = await loadPyodide();
py.runPython(harness);
const run = py.globals.get('__fieldly_run');
const out = jobs.map((j) => JSON.parse(run(j.code, j.entry, JSON.stringify(j.argsList))));
process.stdout.write(JSON.stringify(out));
