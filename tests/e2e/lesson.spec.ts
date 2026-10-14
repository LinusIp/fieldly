import { expect, test, type Page } from '@playwright/test';

/**
 * §13.3 steps 2, 3 and 5 with the Phase 2 placeholder interactives: open the reference lesson,
 * commit the hook prediction and finish its reveal, complete both explore screens, answer every
 * question, solve both challenges — all through the `?debug=1` hook — then check resume.
 */

const LESSON = './#/l/phys2.u3.l2?debug=1';

type Debug = {
  answerCurrent?: () => void;
  loadSolution?: () => void;
  setSeed?: (s: number) => void;
  current?: () => { id: string; type: string } | null;
};

const player = (page: Page) => page.getByTestId('lesson-player');

async function debug(page: Page, fn: keyof Debug, arg?: number): Promise<boolean> {
  return page.evaluate(
    ([name, a]) => {
      const d = (window as unknown as { __fieldlyDebug?: Record<string, (x?: number) => void> })
        .__fieldlyDebug;
      if (!d?.[name as string]) return false;
      d[name as string](a as number | undefined);
      return true;
    },
    [fn, arg] as const,
  );
}

/** Take one action on the current screen; returns the screen id it acted on. */
async function act(page: Page): Promise<string> {
  const id = (await player(page).getAttribute('data-screen')) ?? '';
  const type = await player(page).getAttribute('data-screen-type');
  const enabled = (testId: string) => page.locator(`[data-testid="${testId}"]:not([disabled])`).first();
  if (await enabled('continue').isVisible()) {
    await enabled('continue').click();
    return id;
  }
  if (type === 'challenge') {
    await debug(page, 'loadSolution');
    await enabled('challenge-check').click();
    await expect(page.getByTestId('challenge-success')).toBeVisible();
    return id;
  }
  if (await page.getByTestId('submit').first().isVisible()) {
    await debug(page, 'answerCurrent');
    await enabled('submit').click();
    return id;
  }
  // An explore goal (or the hook's reveal task): load its solution into the interactive.
  expect(await debug(page, 'loadSolution')).toBe(true);
  return id;
}

async function playTo(page: Page, stop: (id: string, type: string | null) => boolean) {
  for (let i = 0; i < 200; i++) {
    const id = (await player(page).getAttribute('data-screen')) ?? '';
    const type = await player(page).getAttribute('data-screen-type');
    if (stop(id, type)) return;
    await act(page);
  }
  throw new Error('lesson did not finish');
}

test('the reference lesson plays end to end with placeholder interactives (§13.3 steps 2–3)', async ({
  page,
}) => {
  await page.goto('./#/s/phys2');
  await page.locator('[data-lesson-id="phys2.u3.l2"]').getByRole('link').first().click();
  await expect(player(page)).toHaveAttribute('data-screen', 'h1');
  await page.goto(LESSON);
  await expect(player(page)).toHaveAttribute('data-screen-type', 'hook');

  const visited = new Set<string>();
  await playTo(page, (id, type) => {
    visited.add(id);
    return type === 'recap';
  });
  for (const id of ['h1', 'e1', 'c1', 's1', 's5', 'ch1', 'e2', 's8', 'ch2', 'wrap'])
    expect(visited).toContain(id);

  const summary = page.getByTestId('summary');
  await expect(summary.getByText('Completed')).toBeVisible();
  await expect(summary.getByRole('img', { name: /[123] of 3 stars/ })).toBeVisible();
  await expect(page.getByTestId('facts')).toContainText('Single resistor');

  // The Explanations tab lists answered questions.
  await page.getByTestId('tab-explanations').click();
  await expect(page.getByTestId('explanation-item').first()).toBeVisible();

  // The path map now shows the lesson as completed.
  await page.goto('./#/s/phys2');
  await expect(page.locator('[data-lesson-id="phys2.u3.l2"]')).toHaveAttribute(
    'data-state',
    /completed|mastered/,
  );
});

test('leaving mid-lesson resumes at the same screen with the same numbers and interactive state (§13.3 step 5)', async ({
  page,
}) => {
  await page.goto(LESSON);
  await expect(player(page)).toHaveAttribute('data-screen', 'h1');
  await debug(page, 'setSeed', 4242);
  // Commit the hook, finish it, then complete the first explore goal only.
  await playTo(page, (id) => id === 'e1');
  await expect(page.locator('[data-task="0"]')).toHaveAttribute('data-done', 'false');
  await debug(page, 'loadSolution');
  await expect(page.locator('[data-task="0"]')).toHaveAttribute('data-done', 'true');
  const interactive = await page.getByTestId('interactive-description').textContent();
  await page.reload();
  await expect(player(page)).toHaveAttribute('data-screen', 'e1');
  await expect(page.locator('[data-task="0"]')).toHaveAttribute('data-done', 'true');
  expect(await page.getByTestId('interactive-description').textContent()).toBe(interactive);

  // On to the first question, then reload: same numbers.
  await playTo(page, (id) => id === 's1');
  const prompt = await page.getByTestId('question').locator('p').first().innerText();
  await page.reload();
  await expect(player(page)).toHaveAttribute('data-screen', 's1');
  expect(await page.getByTestId('question').locator('p').first().innerText()).toBe(prompt);
});
