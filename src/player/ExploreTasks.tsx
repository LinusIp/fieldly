import { useEffect, useMemo, useState } from 'react';
import { Markdown } from '../components/Markdown';
import { Button, CheckIcon } from '../components/ui';
import type { InteractiveRef, Question, Task } from '../content/schema';
import type { Scope } from '../engine/expr';
import { renderTemplate } from '../engine/template';
import { applyTaskSolution, fullScope, resolveConfig, safeBool } from '../interactives/check';
import { InteractiveFrame, useInteractiveModule } from '../interactives/InteractiveHost';
import type { AnyModule } from '../interactives/registry';
import type { AnswerRecord } from '../storage/schema';
import { widgetFor } from '../widgets/registry';
import { usePlayer, withAttempt } from './context';
import { registerDebug } from './debug';
import { answerText, isDone, QuestionRunner } from './QuestionRunner';

export const TASK_HINT_AFTER_MS = 30_000;

/** Whether a prediction can turn out right or wrong (an mcq may mark no option at all). */
export function predictionHasTruth(q: Question): boolean {
  if (q.kind === 'mcq') {
    const opts = (q as { options?: { correct?: boolean }[] }).options;
    return opts ? opts.some((o) => o.correct) : true;
  }
  return q.kind !== 'explain';
}

/** "You predicted it" / "Surprised?" once the observation is in (§2.5). */
export function PredictionOutcome({
  q,
  record,
  scope,
  seed,
}: {
  q: Question;
  record?: AnswerRecord;
  scope: Scope;
  seed: number;
}) {
  if (!record || !isDone(record) || !predictionHasTruth(q)) return null;
  const w = widgetFor(q.kind);
  let answer = '';
  try {
    if (w) answer = w.describe(q, w.correctAnswer(q, { scope, seed }), { scope, seed });
  } catch {
    /* no truth to show */
  }
  return record.correct ? (
    <p
      className="mt-2 flex items-center gap-2 text-sm font-semibold text-ok"
      data-testid="prediction-outcome"
    >
      <CheckIcon /> You predicted it.
    </p>
  ) : (
    <p className="mt-2 text-sm font-semibold text-warn" data-testid="prediction-outcome">
      Surprised? It was {answerText(answer)}.
    </p>
  );
}

const taskKey = (screenId: string, i: number) => `${screenId}#t${i}`;

/**
 * The gated goals of an explore screen or a hook reveal (§8.1): one task at a time; a goal passes
 * when its check holds on the interactive's state; `predict` and `ask` tasks pass when answered.
 */
export function ExploreTasks({
  screenId,
  interactive,
  tasks,
  instruction,
  onAllDone,
}: {
  screenId: string;
  interactive: InteractiveRef;
  tasks: Task[];
  instruction?: string;
  onAllDone?(): void;
}) {
  const { mod, error } = useInteractiveModule(interactive.type);
  if (error) return <p className="text-bad">Could not load the interactive: {error.message}</p>;
  if (!mod) return <p className="text-muted">Loading the interactive…</p>;
  return (
    <TasksInner
      mod={mod}
      screenId={screenId}
      interactive={interactive}
      tasks={tasks}
      instruction={instruction}
      onAllDone={onAllDone}
    />
  );
}

function TasksInner({
  mod,
  screenId,
  interactive,
  tasks,
  instruction,
  onAllDone,
}: {
  mod: AnyModule;
  screenId: string;
  interactive: InteractiveRef;
  tasks: Task[];
  instruction?: string;
  onAllDone?(): void;
}) {
  const pl = usePlayer();
  const { lesson, attempt, scope, readOnly } = pl;
  const config = useMemo(
    () => resolveConfig(mod, interactive.config, scope),
    [mod, interactive.config, scope],
  );
  const saved = attempt.explore[screenId];
  const taskIndex = saved?.taskIndex ?? 0;
  const state = saved?.state ?? mod.initialState(config);
  const allDone = taskIndex >= tasks.length;
  const current = tasks[taskIndex];

  const save = (patch: { taskIndex?: number; state?: unknown; done?: boolean }) =>
    pl.setAttempt((a) => {
      const prev = a.explore[screenId] ?? { taskIndex: 0, state: mod.initialState(config) };
      return { ...a, explore: { ...a.explore, [screenId]: { ...prev, ...patch } } };
    });

  // A goal passes as soon as its check holds on the current state.
  const goalPassed =
    current && 'goal' in current ? safeBool(current.check.expr, fullScope(mod, state, config, scope)) : false;
  useEffect(() => {
    if (!readOnly && goalPassed) save({ taskIndex: taskIndex + 1, state });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalPassed, taskIndex, readOnly]);

  useEffect(() => {
    if (allDone && !readOnly) onAllDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone]);

  const solveCurrent = () => {
    if (!current || !('goal' in current)) return;
    save({ state: applyTaskSolution(mod, state, current.solution, config) });
  };

  useEffect(() => {
    if (!__DEBUG_HOOK__ || readOnly || !current || !('goal' in current)) return;
    return registerDebug('loadSolution', solveCurrent);
  });

  // The task hint appears after 30 s without progress, or on request.
  const [hintShown, setHintShown] = useState<number | null>(null);
  useEffect(() => {
    if (readOnly || !current || !('goal' in current) || !current.hint) return;
    const t = setTimeout(() => setHintShown(taskIndex), TASK_HINT_AFTER_MS);
    return () => clearTimeout(t);
  }, [taskIndex, readOnly, current]);

  const onQuestionRecord = (i: number, rec: AnswerRecord) =>
    pl.update((p) => {
      const a = p.lessons[lesson.id]?.attempt;
      if (!a) return p;
      return withAttempt(p, lesson.id, { ...a, answers: { ...a.answers, [taskKey(screenId, i)]: rec } });
    });

  return (
    <div className="space-y-4">
      {instruction && (
        <p className="text-sm font-medium">
          <Markdown inline>{renderTemplate(instruction, scope)}</Markdown>
        </p>
      )}
      <InteractiveFrame
        mod={mod}
        config={config}
        mode={interactive.mode ?? 'explore'}
        state={state}
        disabled={readOnly}
        onStateChange={(s) => !readOnly && save({ state: s })}
      />
      <ol className="space-y-3" aria-label="Tasks" data-testid="tasks">
        {tasks.slice(0, Math.min(taskIndex + 1, tasks.length)).map((t, i) => {
          const done = i < taskIndex;
          const key = taskKey(screenId, i);
          if ('goal' in t)
            return (
              <li
                key={i}
                className={`rounded-xl border p-3 ${done ? 'border-ok bg-ok-soft/40' : 'border-accent'}`}
                data-task={i}
                data-done={done}
              >
                <div className="flex items-start gap-2">
                  {done ? (
                    <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-ok" />
                  ) : (
                    <span className="mt-0.5 text-accent" aria-hidden="true">
                      ▸
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <Markdown inline>{renderTemplate(t.goal, scope)}</Markdown>
                    {done && <span className="sr-only"> (done)</span>}
                    {!done &&
                      t.hint &&
                      (hintShown === i ? (
                        <p className="mt-1 text-sm text-muted" data-testid="task-hint">
                          Hint: <Markdown inline>{renderTemplate(t.hint, scope)}</Markdown>
                        </p>
                      ) : (
                        !readOnly && (
                          <button
                            type="button"
                            className="mt-1 text-sm text-accent underline"
                            onClick={() => setHintShown(i)}
                          >
                            Show a hint
                          </button>
                        )
                      ))}
                    {!done && mod.placeholder && !readOnly && (
                      <div className="mt-2">
                        <Button variant="secondary" onClick={solveCurrent} data-testid="do-it-for-me">
                          Do it for me
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          const q = 'predict' in t ? t.predict : t.ask;
          const rec = attempt.answers[key];
          const nextGoalDone = 'predict' in t && i + 1 < taskIndex;
          return (
            <li key={i} className="rounded-xl border border-border bg-bg p-3" data-task={i} data-done={done}>
              <QuestionRunner
                question={q}
                scope={scope}
                seed={attempt.seed}
                mode={'predict' in t ? 'prediction' : 'ask'}
                record={rec}
                readOnly={readOnly || (done && isDone(rec))}
                active={!done}
                misconceptionShort={pl.misconceptionShort}
                onRecord={(r) => onQuestionRecord(i, r)}
                onContinue={!done ? () => save({ taskIndex: i + 1 }) : undefined}
                continueLabel={'predict' in t ? 'Now check it' : 'Next task'}
              />
              {nextGoalDone && <PredictionOutcome q={q} record={rec} scope={scope} seed={attempt.seed} />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
