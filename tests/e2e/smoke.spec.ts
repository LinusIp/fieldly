import { expect, test, type Page } from '@playwright/test';

const LESSON = 'phys2.u3.l2';

async function answerCurrent(page: Page) {
  const card = page.getByTestId('question-card');
  await card.locator('[data-correct="true"]').click();
  await page.getByTestId('submit').click();
  await expect(page.getByTestId('explanation')).toBeVisible();
  await page.getByTestId('continue').click();
}

test('home lists all 8 subjects', async ({ page }) => {
  await page.goto('./');
  const cards = page.getByTestId('subject-list').locator('li');
  await expect(cards).toHaveCount(8);
  for (const title of [
    'Calculus I',
    'Calculus II',
    'Physics I: Mechanics',
    'Physics II: Electricity & Magnetism',
    'Linear Algebra',
    'Discrete Mathematics',
    'Data Structures & Algorithms',
    'Probability & Statistics',
  ])
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
});

test('reference lesson: intro → 6 steps → challenge → summary, with resume', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('link', { name: /Physics II: Electricity/ }).click();
  await expect(page).toHaveURL(/#\/s\/phys2/);
  const unit = page.getByRole('button', { name: /Current & DC Circuits/ });
  if ((await unit.getAttribute('aria-expanded')) !== 'true') await unit.click();
  await page.getByRole('link', { name: "Ohm's Law and Electrical Power" }).click();
  await expect(page).toHaveURL(new RegExp(`#/l/${LESSON.replace(/\./g, '\\.')}`));

  // Re-open with the debug hook (dev/e2e builds only).
  await page.goto(`./#/l/${LESSON}?debug=1`);
  await expect(page.getByTestId('intro')).toBeVisible();
  await page.getByTestId('start-practice').click();

  // Answer three steps, then reload mid-lesson: same step, same numbers.
  for (let i = 0; i < 3; i++) await answerCurrent(page);
  const promptBefore = await page.getByTestId('question-card').innerText();
  await page.reload();
  await expect(page.getByTestId('question-card')).toBeVisible();
  expect(await page.getByTestId('question-card').innerText()).toBe(promptBefore);
  await expect(page.getByTestId('answered-step')).toHaveCount(3);

  // Finish the remaining core steps (plus any inserted ones).
  for (let i = 0; i < 10; i++) {
    if (await page.getByTestId('challenge').count()) break;
    await answerCurrent(page);
  }
  await expect(page.getByTestId('challenge')).toBeVisible();
  await expect(page.getByTestId('facts').locator('li')).toHaveCount(6);

  // Load the solution through the debug hook, check it, see success.
  await page.evaluate(() =>
    (window as unknown as { __fieldlyDebug: { loadSolution(): void } }).__fieldlyDebug.loadSolution(),
  );
  await page.getByTestId('challenge-check').click();
  await expect(page.getByTestId('challenge-success')).toBeVisible();
  await page.getByTestId('to-summary').click();

  await expect(page.getByTestId('summary')).toBeVisible();
  await expect(page.getByTestId('summary-stars').getByRole('img')).toHaveAttribute(
    'aria-label',
    '3 of 3 stars',
  );

  // Explanations tab shows every answered step.
  await page.getByRole('tab', { name: 'Explanations' }).click();
  await expect(page.getByTestId('explanations-tab')).toContainText('**Answer:**'.replace(/\*/g, '').trim());

  // The subject page shows the stars too.
  await page.goto('./#/s/phys2');
  await expect(
    page.locator(`[data-lesson-id="${LESSON}"]`).getByRole('img', { name: '3 of 3 stars' }),
  ).toBeVisible();
});

test('production-only hook is absent without ?debug=1', async ({ page }) => {
  await page.goto(`./#/l/${LESSON}`);
  await page.getByTestId('start-practice').click();
  await expect(page.locator('[data-correct]')).toHaveCount(0);
});
