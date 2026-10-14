/**
 * One-shot motion from §10.6, played with the Web Animations API so it can restart on demand.
 * Under `prefers-reduced-motion` or the reduced-motion setting nothing moves.
 */
export function reducedMotion(): boolean {
  if (typeof window === 'undefined') return true;
  return (
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true ||
    document.documentElement.dataset.motion === 'reduce'
  );
}

/** Correct answer: the card pops once (1 → 1.02 → 1, 180 ms). */
export function pop(el: Element | null | undefined): void {
  if (!el || reducedMotion() || !('animate' in el)) return;
  el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.02)' }, { transform: 'scale(1)' }], {
    duration: 180,
    easing: 'ease-out',
  });
}

/** Wrong answer: the input shakes three times by 6 px (240 ms). */
export function shake(el: Element | null | undefined): void {
  if (!el || reducedMotion() || !('animate' in el)) return;
  el.animate(
    [
      { transform: 'translateX(0)' },
      { transform: 'translateX(-6px)' },
      { transform: 'translateX(6px)' },
      { transform: 'translateX(-6px)' },
      { transform: 'translateX(6px)' },
      { transform: 'translateX(-6px)' },
      { transform: 'translateX(0)' },
    ],
    { duration: 240, easing: 'ease-in-out' },
  );
}
