import { useCallback, useEffect, useMemo } from 'react';
import { track } from '../analytics';
import { ChallengeHost, type ChallengeSaved } from '../challenges/ChallengeHost';
import { Loading } from '../components/ui';
import { renderTemplate } from '../engine/template';
import {
  applyChallengeScore,
  challengeScope,
  completeLesson,
  ensureChallenge,
  recordMisconception,
  stepLabel,
  stepMap,
} from './attempt';
import { usePlayer } from './context';
import { FactsDrawer, FactsPanel } from './FactsPanel';

export function ChallengeStage() {
  const { lesson, attempt, setAttempt, update, scope, debug, progress } = usePlayer();
  const ch = lesson.challenge;
  const chScope = useMemo(() => challengeScope(lesson, attempt.seed), [lesson, attempt.seed]);

  // The module (and its initial state) is loaded lazily by ChallengeHost; start with state null.
  useEffect(() => {
    if (!attempt.challenge) setAttempt((a, p) => ensureChallenge(lesson, a, p, () => null));
  }, [attempt.challenge, lesson, setAttempt]);

  const setSaved = useCallback(
    (fn: (s: ChallengeSaved) => ChallengeSaved) =>
      setAttempt((a) => (a.challenge ? { ...a, challenge: fn(a.challenge) } : a)),
    [setAttempt],
  );

  if (!attempt.challenge) return <Loading what="Preparing the challenge" />;

  const steps = stepMap(lesson);
  const uses = ch.uses ?? [];
  const buildsOnAuto = uses.length
    ? `This builds on ${uses
        .map((u) => `${stepLabel(lesson, u)}: ${renderTemplate(steps.get(u)?.establishes ?? '', scope)}`)
        .join(' · ')}`
    : null;

  const finish = () =>
    update((p) => {
      const a = p.lessons[lesson.id]?.attempt;
      if (!a) return p;
      const r = completeLesson(lesson, a, p, new Date());
      track({ type: 'lesson-completed', lessonId: lesson.id, meanCore: r.meanCore, stars: r.stars });
      return r.progress;
    });

  return (
    <ChallengeHost
      lessonId={lesson.id}
      challenge={ch}
      scope={chScope}
      saved={attempt.challenge}
      buildsOnAuto={buildsOnAuto}
      buildsOnLabels={uses.map((u) => stepLabel(lesson, u))}
      reducedMotion={
        progress.settings.reducedMotion || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      }
      debug={debug}
      setSaved={setSaved}
      onSolved={(score, difficulty) =>
        update((p) => applyChallengeScore(lesson, p, difficulty, score, new Date()))
      }
      onMisconception={(id) => update((p) => recordMisconception(p, id, new Date()))}
      onContinue={finish}
      sidebar={
        <>
          <div className="hidden lg:block">
            <FactsPanel facts={attempt.facts} />
          </div>
          <FactsDrawer facts={attempt.facts} />
        </>
      }
    />
  );
}
