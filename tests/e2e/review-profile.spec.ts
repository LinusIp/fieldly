import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const LESSON = 'phys2.u3.l2';

test('a missed question comes back in review with new numbers', async ({ page }) => {
  await page.goto(`./#/l/${LESSON}?debug=1`);
  await page.getByTestId('start-practice').click();
  const card = page.getByTestId('question-card');
  const lessonPrompt = await card.locator('[id$="-prompt"]').innerText();

  // Miss Q1 twice → score 0 → it enters review box 1.
  const wrong = card.locator('label[data-option]:not([data-correct])');
  await wrong.first().click();
  await page.getByTestId('submit').click();
  await expect(page.getByTestId('misconception-feedback')).toBeVisible();
  await card.locator('label[data-option]:not([data-correct]):has(input:not([disabled]))').first().click();
  await page.getByTestId('submit').click();
  await expect(page.getByTestId('result')).toContainText('Not this time');

  // Make the item due now (it would normally wait a day).
  await page.waitForTimeout(400); // let the debounced save land
  await page.evaluate(() => {
    const key = 'fieldly:progress';
    const p = JSON.parse(localStorage.getItem(key)!);
    for (const k of Object.keys(p.review)) p.review[k].due = new Date(Date.now() - 1000).toISOString();
    localStorage.setItem(key, JSON.stringify(p));
  });
  await page.goto('./#/');
  await page.reload();
  await expect(page.getByRole('link', { name: /Review, 1 due/ })).toBeVisible();
  await page.getByRole('link', { name: /Review, 1 due/ }).click();

  const reviewCard = page.getByTestId('question-card');
  await expect(reviewCard).toBeVisible();
  const reviewPrompt = await reviewCard.locator('[id$="-prompt"]').innerText();
  expect(reviewPrompt).not.toBe(lessonPrompt);
  expect(reviewPrompt).toMatch(/battery is connected across a single/);

  // Answer it correctly (I = V/R from the new numbers) → it moves up to box 2.
  const nums = reviewPrompt.match(/(d+(?:.d+)?) V battery.*?(d+(?:.d+)?) Ω/s)!;
  const label = `${Number((Number(nums[1]) / Number(nums[2])).toPrecision(3))} A`;
  await reviewCard
    .locator('label[data-option]')
    .filter({ has: page.getByText(label, { exact: true }) })
    .click();
  await page.getByTestId('submit').click();
  await expect(page.getByTestId('result')).toContainText('Correct');
  await page.getByTestId('continue').click();
  await expect(page.getByTestId('review-done')).toContainText('box 1 → 2');
});

test('export, reset and import restore progress', async ({ page }) => {
  // Make some progress: complete the reference lesson.
  await page.goto(`./#/l/${LESSON}?debug=1`);
  await page.getByTestId('start-practice').click();
  for (let i = 0; i < 10; i++) {
    await expect(page.getByTestId('question-card').or(page.getByTestId('challenge'))).toBeVisible();
    if (await page.getByTestId('challenge').count()) break;
    await page.getByTestId('question-card').locator('[data-correct="true"]').click();
    await page.getByTestId('submit').click();
    await page.getByTestId('continue').click();
  }
  await page.waitForFunction(
    () =>
      typeof (window as unknown as { __fieldlyDebug?: { loadSolution?: unknown } }).__fieldlyDebug
        ?.loadSolution === 'function',
  );
  await page.evaluate(() =>
    (window as unknown as { __fieldlyDebug: { loadSolution(): void } }).__fieldlyDebug.loadSolution(),
  );
  await page.getByTestId('challenge-check').click();
  await page.getByTestId('to-summary').click();
  await expect(page.getByTestId('summary')).toBeVisible();

  await page.goto('./#/profile');
  const completed = page.getByText('Lessons completed').locator('..');
  await expect(completed).toContainText('1');

  // Export.
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export').click()]);
  expect(download.suggestedFilename()).toMatch(/^fieldly-progress-\d{4}-\d{2}-\d{2}\.json$/);
  const file = await download.path();
  const exported = JSON.parse(readFileSync(file, 'utf8'));
  expect(exported.lessons[LESSON].status).toBe('completed');

  // Reset (requires typing RESET).
  await page.getByText('Reset all progress…').click();
  await expect(page.getByTestId('reset')).toBeDisabled();
  await page.getByTestId('reset-input').fill('RESET');
  await page.getByTestId('reset').click();
  await expect(completed).toContainText('0');

  // Import → summary → confirm → restored.
  await page.getByTestId('import-file').setInputFiles(file);
  await expect(page.getByTestId('import-summary')).toContainText('1 lessons completed');
  await page.getByTestId('import-confirm').click();
  await expect(completed).toContainText('1');
  await page.reload();
  await expect(page.getByText('Lessons completed').locator('..')).toContainText('1');
  await page.goto('./#/s/phys2');
  await expect(
    page.locator(`[data-lesson-id="${LESSON}"]`).getByRole('img', { name: /3 of 3 stars/ }),
  ).toBeVisible();
});
