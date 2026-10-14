import { expect, test, type Page } from '@playwright/test';

const LESSONS = Array.from({ length: 8 }, (_, i) => `phys2.u3.l${i + 1}`);

async function playLesson(page: Page, lessonId: string) {
  await page.goto(`./#/l/${lessonId}?debug=1`);
  await page.getByTestId('start-practice').click();
  for (let i = 0; i < 12; i++) {
    const card = page.getByTestId('question-card');
    // After the last step the challenge module loads lazily; wait for whichever appears.
    await expect(card.or(page.getByTestId('challenge'))).toBeVisible();
    if (await page.getByTestId('challenge').count()) break;
    await card.locator('[data-correct="true"]').click();
    await page.getByTestId('submit').click();
    await page.getByTestId('continue').click();
  }
  await expect(page.getByTestId('challenge')).toBeVisible();
  // Wait for the lazily loaded challenge module, then load its solution through the debug hook.
  await page.waitForFunction(() => {
    const w = window as unknown as { __fieldlyDebug?: { loadSolution?: () => void } };
    return typeof w.__fieldlyDebug?.loadSolution === 'function';
  });
  await page.evaluate(() =>
    (window as unknown as { __fieldlyDebug: { loadSolution(): void } }).__fieldlyDebug.loadSolution(),
  );
  await page.getByTestId('challenge-check').click();
  await expect(page.getByTestId('challenge-success')).toBeVisible();
  await page.getByTestId('to-summary').click();
  await expect(page.getByTestId('summary')).toBeVisible();
  return page.getByTestId('summary').innerText();
}

/** Seed stored progress with a subject rating so variant selection starts high or low. */
async function seedRating(page: Page, rating: number) {
  await page.goto('./');
  await page.evaluate((r) => {
    localStorage.setItem(
      'fieldly:progress',
      JSON.stringify({
        version: 1,
        createdAt: new Date().toISOString(),
        ratings: { subject: { phys2: r }, concept: {} },
        lessons: {},
        questions: {},
        misconceptions: {},
        review: {},
        settings: { theme: 'system', fontScale: 1, reducedMotion: true, codeLang: 'python' },
        activity: {},
      }),
    );
  }, rating);
}

test.describe('phys2 U3 plays end to end', () => {
  test.setTimeout(240_000);

  test('as a new student (easier variants)', async ({ page }) => {
    for (const id of LESSONS) {
      const summary = await playLesson(page, id);
      expect(summary).toContain('Lesson complete');
    }
    await page.goto('./#/s/phys2');
    for (const id of LESSONS)
      await expect(
        page.locator(`[data-lesson-id="${id}"]`).getByRole('img', { name: /of 3 stars/ }),
      ).toBeVisible();
  });

  test('as a strong student (harder variants)', async ({ page }) => {
    await seedRating(page, 1600);
    let sawHarder = false;
    for (const id of LESSONS) {
      const summary = await playLesson(page, id);
      if (summary.includes('harder')) sawHarder = true;
    }
    expect(sawHarder).toBe(true);
  });
});
