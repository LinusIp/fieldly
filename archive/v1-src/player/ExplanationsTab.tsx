import { Markdown } from '../components/Markdown';
import { renderTemplate } from '../engine/template';
import { challengeScope, currentQuestion, optionsFor, stepLabel } from './attempt';
import { usePlayer } from './context';

/** Every step in the attempt; explanations unlock once a step is answered. */
export function ExplanationsTab() {
  const { lesson, attempt, scope } = usePlayer();
  return (
    <div className="max-w-[760px] space-y-4" data-testid="explanations-tab">
      <p className="text-sm text-muted">Explanations for every question you've answered in this attempt.</p>
      {attempt.sequence.map((id) => {
        const label = stepLabel(lesson, id);
        const ans = attempt.answers[id];
        if (attempt.skippedSteps.includes(id))
          return (
            <section
              key={id}
              className="rounded-xl border border-dashed border-border p-4 text-sm text-muted"
            >
              <h3 className="font-semibold">{label}</h3>
              <p>Skipped.</p>
            </section>
          );
        if (!ans || ans.score === undefined)
          return (
            <section key={id} className="rounded-xl border border-dashed border-border p-4 text-sm">
              <h3 className="font-semibold text-muted">{label}</h3>
              <p className="text-muted">Answer this question to unlock its explanation.</p>
            </section>
          );
        const q = currentQuestion(lesson, attempt, id)!;
        const options = optionsFor(q, scope, attempt.seed);
        const correct = options.find((o) => o.correct)!;
        const picks = ans.selected.map((i) => options.find((o) => o.index === i)!);
        return (
          <section key={id} className="rounded-xl border border-border bg-surface p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{label}</h3>
            <div className="mt-2">
              <Markdown>{renderTemplate(q.prompt, scope)}</Markdown>
            </div>
            <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-3">
              <dt className="text-muted">Your choice</dt>
              <dd>
                {picks.map((o, i) => (
                  <span key={i}>
                    {i > 0 && ', then '}
                    <Markdown inline>{o.text}</Markdown> {o.correct ? '✓' : '✕'}
                  </span>
                ))}
              </dd>
              <dt className="text-muted">Correct answer</dt>
              <dd>
                <Markdown inline>{correct.text}</Markdown>
              </dd>
            </dl>
            <div className="mt-3 rounded-lg bg-bg p-4">
              <Markdown>{renderTemplate(q.explanation, scope)}</Markdown>
            </div>
          </section>
        );
      })}
      {attempt.challenge && (attempt.challenge.solved || attempt.challenge.usedSolution) && (
        <ChallengeExplanation />
      )}
    </div>
  );
}

function ChallengeExplanation() {
  const { lesson, attempt } = usePlayer();
  const v = attempt.challenge!.variant as 'easier' | 'standard' | 'harder';
  const variant = lesson.challenge.variants[v];
  const chScope = challengeScope(lesson, attempt.seed);
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
        Challenge — {lesson.challenge.title}
      </h3>
      <div className="mt-3 rounded-lg bg-bg p-4">
        <Markdown>{renderTemplate(variant.explanation, chScope)}</Markdown>
      </div>
    </section>
  );
}
