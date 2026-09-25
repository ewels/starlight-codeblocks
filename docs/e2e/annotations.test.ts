import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./features/annotations/');
});

const example = (page: import('@playwright/test').Page, n = 0) =>
  page.locator('.example').nth(n).locator('.pane').nth(1).locator('.expressive-code');

test('a marker opens its note under it, with the pointer', async ({ page }) => {
  const block = example(page);
  const marker = block.getByRole('button', { name: 'Annotation 1' });
  const note = block.locator('.scb-annotation-popover').first();
  await expect(note).toBeHidden();
  await marker.click();
  await expect(note).toBeVisible();
  await expect(note).toHaveText('One job per version, run in parallel.');
  const m = await marker.boundingBox();
  const n = await note.boundingBox();
  expect(n && m && n.y).toBeGreaterThan((m?.y ?? 0) + (m?.height ?? 0));
  await page.mouse.click(5, 5);
  await expect(note).toBeHidden();
});

test('opening one note closes the other, and Escape closes it, with the keyboard', async ({ page }) => {
  const block = example(page);
  const notes = block.locator('.scb-annotation-popover');
  await block.getByRole('button', { name: 'Annotation 1' }).focus();
  await page.keyboard.press('Enter');
  await expect(notes.nth(0)).toBeVisible();
  await block.getByRole('button', { name: 'Annotation 2' }).focus();
  await page.keyboard.press('Enter');
  await expect(notes.nth(1)).toBeVisible();
  await expect(notes.nth(0)).toBeHidden();
  await expect(notes.nth(1).locator('code')).toHaveText('uv');
  await page.keyboard.press('Escape');
  await expect(notes.nth(1)).toBeHidden();
});

test('the note stays inside the viewport on a phone', async ({ page }) => {
  const block = example(page);
  await block.getByRole('button', { name: 'Annotation 1' }).click();
  const n = await block.locator('.scb-annotation-popover').first().boundingBox();
  const width = page.viewportSize()?.width ?? 0;
  expect(n?.x).toBeGreaterThanOrEqual(0);
  expect((n?.x ?? 0) + (n?.width ?? 0)).toBeLessThanOrEqual(width);
});

test('copying leaves the markers and notes out', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await example(page).locator('.copy button').focus();
  await page.keyboard.press('Enter');
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('python: ["3.12", "3.13"]\n');
  expect(copied).not.toContain('annotate');
  expect(copied).not.toContain('One job');
});

test('the marker changes colour instantly under reduced motion', async ({ page }) => {
  const marker = example(page).locator('.scb-annotation').first();
  const duration = await marker.evaluate((el) => getComputedStyle(el).transitionDuration);
  const reduced = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  expect(duration).toBe(reduced ? '0s' : '0.15s');
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('a marker still opens its note', async ({ page }) => {
    const block = example(page);
    await block.getByRole('button', { name: 'Annotation 1' }).click();
    await expect(block.locator('.scb-annotation-popover').first()).toBeVisible();
  });
});

test('prints the notes as a numbered list under the block', async ({ page }) => {
  const block = example(page);
  await expect(block.locator('.scb-annotation-list')).toBeHidden();
  await page.emulateMedia({ media: 'print' });
  await expect(block.locator('.scb-annotation-list li')).toHaveText([
    'One job per version, run in parallel.',
    'Installs uv and caches its downloads between runs.',
  ]);
  await expect(block.locator('.scb-annotation').first()).toBeHidden();
});
