import { expect, test } from '@playwright/test';

const SUBJECTS = [
  'Calculus I',
  'Calculus II',
  'Physics I: Mechanics',
  'Physics II: Electricity & Magnetism',
  'Linear Algebra',
  'Discrete Mathematics',
  'Data Structures & Algorithms',
  'Probability & Statistics',
];

test('Today page loads and all 8 subjects are listed under Subjects (§13.3 step 1)', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('today')).toBeVisible();
  await page.getByRole('link', { name: 'Subjects', exact: true }).click();
  await expect(page).toHaveURL(/#\/subjects/);
  await expect(page.getByTestId('subject-list').locator('li')).toHaveCount(8);
  for (const title of SUBJECTS)
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
});

test('the path map shows every unit and lesson, with placeholders', async ({ page }) => {
  await page.goto('./#/s/phys2');
  const map = page.getByTestId('path-map');
  await expect(map.getByRole('heading', { name: 'Current & DC Circuits' })).toBeVisible();
  const lesson = map.locator('[data-lesson-id="phys2.u3.l2"]');
  await expect(lesson).toContainText("Ohm's Law and Electrical Power");
  await expect(lesson).toContainText('Coming soon');
  await expect(map.locator('[data-lesson-id="phys2.u3.l5"]')).toContainText('Try first');
  await lesson.getByRole('link').click();
  await expect(page).toHaveURL(/#\/l\/phys2\.u3\.l2/);
  await expect(page.getByText('Coming soon')).toBeVisible();
});

test('a refresh on a hash route works', async ({ page }) => {
  await page.goto('./#/s/calc1');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Calculus I', level: 1 })).toBeVisible();
});
