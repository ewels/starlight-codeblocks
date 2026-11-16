import { expect, test } from '@playwright/test';
import { contrast, css, example, once, output } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('./features/split-diff/');
});

test('the keyboard switches every diff block to a split view and back, and the next page load remembers it', async ({
  page,
}) => {
  const block = example(page);
  const unified = block.getByRole('button', { name: 'Unified' });
  const button = block.getByRole('button', { name: 'Split' });
  const pre = block.locator('pre');
  await expect(block.getByRole('group', { name: 'Diff view' })).toBeVisible();
  await expect(unified).toHaveAttribute('aria-pressed', 'true');
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await unified.focus();
  await page.keyboard.press('Tab');
  await expect(button).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(unified).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('pre.scb-split[data-scb-split-sync]')).toHaveCount(4);

  const box = (selector: string, n = 0) => block.locator(selector).nth(n).boundingBox();
  const [line, copy] = [await box('.ec-line.scb-split-left'), await box('.scb-split-copy')];
  expect(copy?.y).toBe(line?.y);
  expect(copy?.x).toBeGreaterThan((line?.x ?? 0) + (line?.width ?? 0) - 1);
  const [del, ins] = [await box('.ec-line.del'), await box('.ec-line.ins')];
  expect(ins?.y).toBe(del?.y);
  await expect(block.locator('.scb-split-gap')).toHaveCount(3);
  await expect(block.locator('.scb-split-copy').first()).toHaveAttribute('aria-hidden', 'true');
  await expect(block.locator('.scb-split-copy .code').first()).toHaveAttribute('inert', '');
  expect(await block.locator('.scb-split-copy [id]').count()).toBe(0);

  await page.reload();
  await expect(pre).toHaveClass(/scb-split/);
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await unified.focus();
  await page.keyboard.press('Space');
  await expect(unified).toHaveAttribute('aria-pressed', 'true');
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-scb-split-sync]:is(.scb-split, :has(.scb-split-copy, .scb-split-gap))')).toHaveCount(
    0,
  );
  expect(await page.evaluate(() => localStorage.getItem('scb-diff-view'))).toBe('unified');
});

test('both switch buttons are readable, and the column divider and gaps show in the theme', { tag: '@theme' }, async ({
  page,
}) => {
  const block = example(page);
  const [unified, split] = ['Unified', 'Split'].map((name) => block.getByRole('button', { name }));
  await split.click();
  // The title bar paints its colour behind the header, which is transparent itself.
  const bar = await block.evaluate((el) => getComputedStyle(el).getPropertyValue('--ec-frm-edTabBarBg'));
  for (const button of [unified, split]) {
    expect(await contrast(page, await css(button, 'color'), bar)).toBeGreaterThan(4.5);
  }
  expect(await css(block.locator('.ec-line.ins').first(), 'boxShadow')).toContain('inset');
  expect(await css(block.locator('.scb-split-gap').first(), 'backgroundColor')).not.toBe('rgba(0, 0, 0, 0)');
});

test('a block can start split, switch alone, and keep its view when synced blocks switch', async ({ page }) => {
  const own = example(page, 2);
  const forced = example(page, 3);
  await expect(own.locator('pre')).toHaveClass(/scb-split/);
  await expect(own.getByRole('button', { name: 'Split' })).toHaveAttribute('aria-pressed', 'true');
  await expect(forced.locator('pre')).toHaveClass(/scb-split/);
  await expect(forced.getByRole('group', { name: 'Diff view' })).toHaveCount(0);

  await example(page).getByRole('button', { name: 'Split' }).click();
  await example(page).getByRole('button', { name: 'Unified' }).click();
  await expect(own.locator('pre')).toHaveClass(/scb-split/);
  await expect(forced.locator('pre')).toHaveClass(/scb-split/);

  await own.getByRole('button', { name: 'Unified' }).click();
  await expect(own.locator('pre')).not.toHaveClass(/scb-split/);
  await expect(example(page).getByRole('button', { name: 'Unified' })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => localStorage.getItem('scb-diff-view'))).toBe('unified');
});

test('the pressed button stands apart from the other by more than its text colour', { tag: '@theme' }, async ({
  page,
}) => {
  const [unified, split] = ['Unified', 'Split'].map((name) => example(page).getByRole('button', { name }));
  expect(await css(unified, 'backgroundColor')).not.toBe(await css(split, 'backgroundColor'));
  expect(await css(split, 'backgroundColor')).toBe('rgba(0, 0, 0, 0)');
});

test('a walkthrough of diffs changes step without the token animation, which would drop the diff colours', async ({
  page,
}) => {
  once();
  const walkthrough = output(page, 4);
  await walkthrough.getByRole('button', { name: 'Next' }).click();
  // The click handler starts the animation, so it is there at once or not at all.
  expect(await walkthrough.locator('.scb-steps-anim').count()).toBe(0);
  await expect(walkthrough.locator('.scb-steps-current .ec-line.ins')).toHaveCount(4);
});
