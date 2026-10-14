import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { useEffect, useRef, useState } from 'react';
import { CheckIcon, CrossIcon } from '../../components/ui';
import type { ChallengeComponentProps } from '../types';
import { LANGS, type Config, type Lang, type State } from './logic';
import { runTests } from './runner';

const LANG_NAME: Record<Lang, string> = { python: 'Python', javascript: 'JavaScript' };

const theme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--c-bg)',
    color: 'var(--c-text)',
    fontSize: '0.9rem',
    border: '1px solid var(--c-border)',
    borderRadius: '10px',
  },
  '.cm-content': { fontFamily: 'var(--font-mono)', caretColor: 'var(--c-text)' },
  '.cm-gutters': {
    backgroundColor: 'var(--c-surface-2)',
    color: 'var(--c-muted)',
    border: 'none',
    borderTopLeftRadius: '10px',
    borderBottomLeftRadius: '10px',
  },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--c-accent) 8%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--c-text)' },
  '&.cm-focused': { outline: '3px solid var(--c-accent)', outlineOffset: '2px' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'color-mix(in srgb, var(--c-accent) 25%, transparent) !important',
  },
  '.cm-cursor': { borderLeftColor: 'var(--c-text)' },
});

function langExt(l: Lang) {
  return l === 'python' ? python() : javascript();
}

export function CodeRunner({
  config,
  state,
  disabled,
  onStateChange,
  showingSolution,
  codeLang,
}: ChallengeComponentProps<Config, State>) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const langComp = useRef(new Compartment());
  const roComp = useRef(new Compartment());
  const stateRef = useRef(state);
  const [status, setStatus] = useState('');
  const [running, setRunning] = useState(false);

  useEffect(() => {
    stateRef.current = state;
  });

  // Start in the student's preferred language while the code is untouched.
  useEffect(() => {
    const s = stateRef.current;
    if (
      codeLang &&
      s.lang !== codeLang &&
      !s.results &&
      s.code.python === config.starter.python &&
      s.code.javascript === config.starter.javascript
    )
      onStateChange({ ...s, lang: codeLang });
    // Only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Create the editor once.
  useEffect(() => {
    if (!host.current) return;
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: stateRef.current.code[stateRef.current.lang],
        extensions: [
          basicSetup,
          theme,
          EditorState.tabSize.of(4),
          langComp.current.of(langExt(stateRef.current.lang)),
          roComp.current.of(EditorState.readOnly.of(false)),
          EditorView.contentAttributes.of({ 'aria-label': 'Code editor' }),
          EditorView.updateListener.of((u) => {
            if (!u.docChanged) return;
            const s = stateRef.current;
            const text = u.state.doc.toString();
            if (text === s.code[s.lang]) return;
            onStateChange({ ...s, code: { ...s.code, [s.lang]: text } });
          }),
        ],
      }),
    });
    view.current = v;
    return () => {
      v.destroy();
      view.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the editor in sync with external state (language switch, reset, solution).
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const want = state.code[state.lang];
    v.dispatch({
      effects: [
        langComp.current.reconfigure(langExt(state.lang)),
        roComp.current.reconfigure(EditorState.readOnly.of(disabled)),
      ],
      ...(v.state.doc.toString() !== want
        ? { changes: { from: 0, to: v.state.doc.length, insert: want } }
        : {}),
    });
  }, [state.lang, state.code, disabled]);

  const run = async () => {
    setRunning(true);
    try {
      const s = stateRef.current;
      const results = await runTests(s.lang, s.code[s.lang], config, setStatus);
      onStateChange({ ...stateRef.current, results });
    } finally {
      setRunning(false);
      setStatus('');
    }
  };

  const r = state.results;
  const fresh = r && r.lang === state.lang && r.code === state.code[state.lang];

  return (
    <div className="space-y-3" data-testid="code-runner">
      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Language" className="flex gap-1">
          {LANGS.map((l) => (
            <label
              key={l}
              className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm font-medium has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent ${
                state.lang === l ? 'border-accent bg-accent-soft text-accent' : 'border-border'
              }`}
            >
              <input
                type="radio"
                className="sr-only"
                name="code-lang"
                checked={state.lang === l}
                disabled={running}
                onChange={() => onStateChange({ ...state, lang: l })}
              />
              {LANG_NAME[l]}
            </label>
          ))}
        </div>
        <span className="text-xs text-muted">
          Write <code className="font-mono">{config.entry[state.lang]}</code>
        </span>
        <div className="ml-auto flex gap-2">
          {!disabled && (
            <button
              type="button"
              className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-2"
              onClick={() =>
                onStateChange({
                  ...state,
                  code: { ...state.code, [state.lang]: config.starter[state.lang] },
                  results: undefined,
                })
              }
            >
              Reset code
            </button>
          )}
          <button
            type="button"
            disabled={running}
            onClick={() => void run()}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-on-accent disabled:opacity-50"
            data-testid="run-tests"
          >
            {running ? 'Running…' : 'Run tests'}
          </button>
        </div>
      </div>

      {showingSolution && <p className="text-sm text-muted">Reference solution (read-only):</p>}
      <div ref={host} data-testid="code-editor" />

      <div aria-live="polite" className="min-h-[1.25rem] text-sm text-muted">
        {status}
      </div>

      {r && (
        <section
          aria-label="Test results"
          className="rounded-lg border border-border p-3 text-sm"
          data-testid="test-results"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <strong>
              {r.passed} of {r.total} tests passed
            </strong>
            {!fresh && <span className="text-xs text-warn">The code has changed since this run.</span>}
          </div>
          {r.error && (
            <pre className="mt-2 overflow-x-auto rounded bg-bad-soft p-2 text-xs text-bad">{r.error}</pre>
          )}
          <ul className="mt-2 space-y-1.5">
            {r.tests.map((t, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className={t.ok ? 'text-ok' : 'text-bad'}>
                  {t.ok ? <CheckIcon className="mt-0.5 h-4 w-4" /> : <CrossIcon className="mt-0.5 h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">
                    {t.name}
                    {t.hidden && <span className="ml-1 text-xs text-muted">(hidden)</span>}
                    <span className="sr-only">{t.ok ? ' passed' : ' failed'}</span>
                  </span>
                  {!t.hidden && (
                    <span className="block font-mono text-xs text-muted">
                      input {t.args} → expected {t.expected}
                      {t.got !== undefined && <>, got {t.got}</>}
                      {t.error && <span className="text-bad">, error: {t.error}</span>}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {r.perfPassed !== null && (
            <p className={`mt-2 ${r.perfPassed ? 'text-ok' : 'text-bad'}`}>
              {r.perfPassed ? '✓' : '✕'} Performance test{' '}
              {r.perfPassed
                ? `passed (${Math.round(r.perfMs ?? 0)} ms)`
                : r.passed < r.total
                  ? 'not run — pass the other tests first'
                  : `failed${r.perfMs !== null ? ` (${Math.round(r.perfMs)} ms, limit ${config.perf?.timeLimitMs} ms)` : ' — too slow or wrong on a large input'}`}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
