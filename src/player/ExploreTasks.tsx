import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { factEntries } from './attempt';
import { usePlayer, withAttempt } from './context';
import { registerDebug } from './debug';
import { answerText, FeedbackBanner, isDone, QuestionRunner } from './QuestionRunner';
import { FactsButton } from './Sidebar';

export const TASK_HINT_AFTER_MS = 30_000;

/** Whether a prediction can turn out right or wrong (an mcq may mark no option at all). */
export function predictionHasTruth(q: Question): boolean {
  if (q.kind === 'mcq') {
    const opts = (q as { options?: { correct?: boolean }[] }).options;
    return opts ? opts.some((o) => o.correct) : true;
  }
  return q.kind !== 'explain';
}

function describeAnswer(q: Question, answer: unknown, scope: Scope, seed: number): string {
  const w = widgetFor(q.kind);
  try {
    return w && answer != null ? answerText(w.describe(q, answer, { scope, seed })) : '';
  } catch {
    return '';
  }
}

function truthOf(q: Question, scope: Scope, seed: number): string {
  const w = widgetFor(q.kind);
  try {
    return w ? describeAnswer(q, w.correctAnswer(q, { scope, seed }), scope, seed) : '';
  } catch {
    return '';
  }
}

/** "Called it!" / "Surprised?" once the observation is in (§2.5, §10.7). */
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
  const mine = describeAnswer(q, record.answer, scope, seed);
  return record.correct ? (
    <FeedbackBanner
      tone="correct"
      icon="check"
      title="Called it!"
      line={`You predicted ${mine}.`}
      testId="prediction-outcome"
    />
  ) : (
    <FeedbackBanner
      tone="info"
      icon="cross"
      title="Surprised?"
      line={`You predicted ${mine}; it was ${truthOf(q, scope, seed)}.`}
      testId="prediction-outcome"
    />
  );
}

/** A finished mission: mint card with a check tile and short past-tense copy (§10.5). */
function DoneMission({ children }: { children: ReactNode }) {
  return (
    <li
      className="flex items-center gap-3 rounded-lg border-2 border-outline bg-correct-tint px-3.5 py-3"
      data-done="true"
    >
      <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-sm border-2 border-outline bg-correct text-on-fill">
        <CheckIcon className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}

const taskKey = (screenId: string, i: number) => `${screenId}#t${i}`;

/**
 * The gated goals of an explore screen or a hook reveal (§8.1): one task at a time; a goal passes
 * when its check holds on the interactive's state; `predict` and `ask` tasks pass when answered.
 * Laid out as the board (main column) and "Your missions" (side column), §10.2.
 */
export function ExploreTasks(props: {
  screenId: string;
  interactive: InteractiveRef;
  tasks: Task[];
  title?: ReactNode;
  /** Under the board once every task is done (takeaway, caption, Continue). */
  after?: ReactNode;
  onAllDone?(): void;
}) {
  const { mod, error } = useInteractiveModule(props.interactive.type);
  if (error) return <p className="font-semibold">Could not load the interactive: {error.message}</p>;
  if (!mod) return <p className="text-ink-2">Loading the interactive…</p>;
  return <TasksInner mod={mod} {...props} />;
}

function TasksInner({
  mod,
  screenId,
  interactive,
  tasks,
  title,
  after,
  onAllDone,
}: {
  mod: AnyModule;
  screenId: string;
  interactive: InteractiveRef;
  tasks: Task[];
  title?: ReactNode;
  after?: ReactNode;
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
      const answers = { ...a.answers, [taskKey(screenId, i)]: rec };
      // A committed prediction reveals straight away: the next mission is to observe it (§2.5).
      const t = tasks[i];
      const prev = a.explore[screenId] ?? { taskIndex: 0, state: mod.initialState(config) };
      const explore =
        'predict' in t && isDone(rec) && prev.taskIndex === i
          ? { ...a.explore, [screenId]: { ...prev, taskIndex: i + 1 } }
          : a.explore;
      return withAttempt(p, lesson.id, { ...a, answers, explore });
    });

  const facts = factEntries(lesson, attempt, scope, pl.stepLabel);

  return (
    <div className="flex flex-wrap items-start gap-7">
      <section className="flex min-w-0 flex-[999_1_600px] flex-col gap-4">
        {title}
        <InteractiveFrame
          mod={mod}
          config={config}
          mode={interactive.mode ?? 'explore'}
          state={state}
          disabled={readOnly}
          onStateChange={(s) => !readOnly && save({ state: s })}
        />
        {after}
      </section>

      <aside
        className="flex min-w-0 max-w-[400px] flex-[1_1_320px] flex-col gap-3.5"
        aria-labelledby={`${screenId}-missions`}
      >
        <h2 id={`${screenId}-missions`} className="text-h2">
          Your missions
        </h2>
        <ol className="flex flex-col gap-3.5" data-testid="tasks">
          {tasks.slice(0, Math.min(taskIndex + 1, tasks.length)).map((t, i) => {
            const done = i < taskIndex;
            const key = taskKey(screenId, i);
            if ('goal' in t) {
              if (done)
                return (
                  <DoneMission key={i}>
                    <span className="font-semibold" data-task={i} data-done="true">
                      <Markdown inline>{renderTemplate(t.goal, scope)}</Markdown>
                    </span>
                  </DoneMission>
                );
              return (
                <li
                  key={i}
                  className="flex flex-col gap-3 rounded-lg border-[3px] border-primary bg-surface p-4 shadow-primary"
                  data-task={i}
                  data-done="false"
                >
                  <span className="text-h3 leading-[1.3]">
                    <Markdown inline>{renderTemplate(t.goal, scope)}</Markdown>
                  </span>
                  {t.hint &&
                    (hintShown === i ? (
                      <p
                        className="rounded-lg bg-surface-tint px-3 py-2 font-semibold"
                        data-testid="task-hint"
                      >
                        <Markdown inline>{renderTemplate(t.hint, scope)}</Markdown>
                      </p>
                    ) : (
                      !readOnly && (
                        <Button variant="secondary" className="self-start" onClick={() => setHintShown(i)}>
                          Show a hint
                        </Button>
                      )
                    ))}
                  {mod.placeholder && !readOnly && (
                    <Button
                      variant="secondary"
                      className="self-start"
                      onClick={solveCurrent}
                      data-testid="do-it-for-me"
                    >
                      Do it for me
                    </Button>
                  )}
                </li>
              );
            }
            const q = 'predict' in t ? t.predict : t.ask;
            const rec = attempt.answers[key];
            const observed = 'predict' in t && i + 1 < taskIndex;
            if (done && isDone(rec)) {
              if ('predict' in t && observed && predictionHasTruth(q))
                return (
                  <DoneMission key={i}>
                    <span data-task={i} data-done="true">
                      {rec!.correct ? (
                        <>
                          <strong className="font-extrabold">Called it!</strong> You predicted{' '}
                          {describeAnswer(q, rec!.answer, scope, attempt.seed)}.
                        </>
                      ) : (
                        <>
                          <strong className="font-extrabold">Surprised?</strong> You predicted{' '}
                          {describeAnswer(q, rec!.answer, scope, attempt.seed)}; it was{' '}
                          {truthOf(q, scope, attempt.seed)}.
                        </>
                      )}
                    </span>
                  </DoneMission>
                );
              return (
                <DoneMission key={i}>
                  <span data-task={i} data-done="true">
                    <strong className="font-extrabold">
                      {'predict' in t ? 'Prediction locked in:' : 'Answered:'}
                    </strong>{' '}
                    {describeAnswer(q, rec!.answer, scope, attempt.seed)}
                  </span>
                </DoneMission>
              );
            }
            return (
              <li
                key={i}
                className="rounded-lg border-[3px] border-primary bg-surface p-4 shadow-primary"
                data-task={i}
                data-done={done}
              >
                <QuestionRunner
                  question={q}
                  scope={scope}
                  seed={attempt.seed}
                  mode={'predict' in t ? 'prediction' : 'ask'}
                  record={rec}
                  compact
                  readOnly={readOnly || (done && isDone(rec))}
                  active={!done}
                  misconceptionShort={pl.misconceptionShort}
                  onRecord={(r) => onQuestionRecord(i, r)}
                  onContinue={!done ? () => save({ taskIndex: i + 1 }) : undefined}
                  continueLabel={'predict' in t ? 'Now check it' : 'Next mission'}
                />
              </li>
            );
          })}
        </ol>
        <FactsButton facts={facts} />
      </aside>
    </div>
  );
}
