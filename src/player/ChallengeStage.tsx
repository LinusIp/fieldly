import { Markdown } from '../components/Markdown';
import { Button } from '../components/ui';
import { renderTemplate } from '../engine/template';
import { challengeScope, completeLesson } from './attempt';
import { usePlayer, withAttempt } from './context';
import { track } from '../analytics';

/** Phase 2 stand-in: shows the challenge goal; the interactive host arrives with the challenge framework. */
export function ChallengeStage() {
  const { lesson, attempt, update } = usePlayer();
  const ch = lesson.challenge;
  const scope = challengeScope(lesson, attempt.seed);
  const finish = () =>
    update((p) => {
      const a = p.lessons[lesson.id]?.attempt;
      if (!a) return p;
      const withCh = {
        ...a,
        challenge: { variant: 'standard', state: null, hintsUsed: 0, checks: 0, solved: false },
      };
      const r = completeLesson(lesson, withCh, withAttempt(p, lesson.id, withCh), new Date());
      track({ type: 'lesson-completed', lessonId: lesson.id, meanCore: r.meanCore, stars: r.stars });
      return r.progress;
    });
  return (
    <div className="max-w-[760px] space-y-4">
      <section className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-xl font-semibold">Challenge — {ch.title}</h2>
        <div className="mt-2">
          <Markdown>{renderTemplate(ch.variants.standard.goal, scope)}</Markdown>
        </div>
        <p className="mt-4 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
          The interactive {ch.type} for this challenge is not available yet.
        </p>
      </section>
      <Button onClick={finish} data-testid="finish-lesson">
        Finish lesson
      </Button>
    </div>
  );
}
