import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

const current = (page: Page) => page.locator('.carousel .slide[data-current]');
const tile = (page: Page, name: string) =>
  page.locator('.carousel .tile', { hasText: new RegExp(`^\\s*${name}\\s*$`) });
const interval = 7000;

test.describe('rotation', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'reduced-motion', 'Rotation is off under reduced motion.');
    await page.clock.install();
    await page.goto('./');
    await expect(page.locator('.carousel[data-ready]')).toBeAttached();
  });

  test('advances on its own without an announcement', async ({ page }) => {
    await expect(current(page)).toHaveAttribute('data-feature', 'features/comment-notation');
    await page.clock.runFor(interval);
    await expect(current(page)).toHaveAttribute('data-feature', 'features/annotations');
    await expect(tile(page, 'Annotations')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.carousel [data-status]')).toHaveText('');
  });

  test('the pause control stops and starts the rotation', async ({ page }) => {
    const rotation = page.locator('.carousel .rotation');
    await expect(rotation).toHaveAccessibleName('Pause');
    await rotation.click();
    await page.mouse.move(0, 0);
    await expect(rotation).toHaveAccessibleName('Play');
    await page.clock.runFor(interval * 2);
    await expect(current(page)).toHaveAttribute('data-feature', 'features/comment-notation');
    await rotation.click();
    await page.mouse.move(0, 0);
    await page.clock.runFor(interval);
    await expect(current(page)).toHaveAttribute('data-feature', 'features/annotations');
  });

  test('pauses while the pointer is over the carousel', async ({ page }) => {
    await page.locator('.carousel .slide[data-current] .expressive-code').hover();
    await page.clock.runFor(interval * 2);
    await expect(current(page)).toHaveAttribute('data-feature', 'features/comment-notation');
    await page.mouse.move(0, 0);
    await page.clock.runFor(interval);
    await expect(current(page)).toHaveAttribute('data-feature', 'features/annotations');
  });

  test('pauses while focus is in the carousel', async ({ page }) => {
    await tile(page, 'Focus').focus();
    await page.clock.runFor(interval * 2);
    await expect(current(page)).toHaveAttribute('data-feature', 'features/comment-notation');
    await page.locator('h1').click();
    await page.mouse.move(0, 0);
    await page.clock.runFor(interval);
    await expect(current(page)).toHaveAttribute('data-feature', 'features/annotations');
  });

  test('pauses while a reader uses an example', async ({ page }) => {
    await tile(page, 'Annotations').click();
    await page.locator('.carousel .rotation').click();
    const marker = page.locator('.carousel .slide[data-current] button[popovertarget]').first();
    await marker.click();
    await expect(page.locator(`[id="${await marker.getAttribute('popovertarget')}"]`)).toBeVisible();
    await page.clock.runFor(interval * 2);
    await expect(current(page)).toHaveAttribute('data-feature', 'features/annotations');
  });

  test('selecting a feature stops the rotation', async ({ page }) => {
    await tile(page, 'Focus').click();
    await page.locator('h1').click();
    await page.mouse.move(0, 0);
    await page.clock.runFor(interval * 2);
    await expect(current(page)).toHaveAttribute('data-feature', 'features/focus');
    await expect(page.locator('.carousel .rotation')).toHaveAccessibleName('Play');
  });
});

test('selecting a button shows its example and announces it', async ({ page }) => {
  await page.goto('./');
  await tile(page, 'Word-level diff').click();
  const slide = current(page);
  await expect(slide).toHaveAttribute('data-feature', 'features/word-level-diff');
  await expect(slide).toBeVisible();
  await expect(slide.locator('.ec-line').first()).toBeVisible();
  await expect(slide.getByRole('link', { name: 'Read the Word-level diff documentation' })).toHaveAttribute(
    'href',
    '/starlight-codeblocks/features/word-level-diff/',
  );
  await expect(page.locator('.carousel .slide:not([data-current])').first()).toBeHidden();
  await expect(page.locator('.carousel .tile[aria-pressed="true"]')).toHaveCount(1);
  await expect(tile(page, 'Word-level diff')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.carousel [data-status]')).toHaveText('Word-level diff, 10 of 24');
});

test('the current button differs by more than colour', async ({ page }) => {
  await page.goto('./');
  await tile(page, 'Focus').click();
  const weight = (name: string) => tile(page, name).evaluate((el) => getComputedStyle(el).fontWeight);
  expect(await weight('Focus')).toBe('600');
  expect(await weight('Footnotes')).toBe('400');
});

test('the buttons follow the sidebar groups', async ({ page }) => {
  await page.goto('./getting-started/');
  const sidebar = await page.locator('nav[aria-label="Main"] summary .group-label').allTextContents();
  await page.goto('./');
  const labels = await page.locator('.carousel .group-label').allTextContents();
  expect(sidebar.map((s) => s.trim()).filter((s) => labels.includes(s))).toEqual(labels);
  await expect(page.locator('.carousel .tile')).toHaveCount(24);
  await expect(page.locator('.carousel .tile svg[aria-hidden], .carousel .tile [aria-hidden] svg')).toHaveCount(24);
});

test('works with the keyboard', async ({ page }) => {
  await page.goto('./');
  const button = tile(page, 'Hidden lines');
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(current(page)).toHaveAttribute('data-feature', 'features/hidden-lines');
  expect(await button.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
  await tile(page, 'Focus').focus();
  await page.keyboard.press('Space');
  await expect(current(page)).toHaveAttribute('data-feature', 'features/focus');
  const rotation = page.locator('.carousel .rotation');
  await rotation.focus();
  await page.keyboard.press('Enter');
  await expect(rotation).toHaveAccessibleName(/Pause|Play/);
});

test('does not rotate or animate under reduced motion', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'reduced-motion', 'Only for the reduced-motion project.');
  await page.clock.install();
  await page.goto('./');
  await expect(page.locator('.carousel .rotation')).toHaveAccessibleName('Play');
  await page.clock.runFor(interval * 3);
  await expect(current(page)).toHaveAttribute('data-feature', 'features/comment-notation');
  await tile(page, 'Focus').click();
  expect(await current(page).evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s');
});

test('fits a phone screen', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('phone'), 'Only for phones.');
  await page.goto('./');
  for (const name of ['Side-by-side annotations', 'Scrollycoding', 'Code switcher']) {
    await tile(page, name).click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  }
});

test('has no accessibility violations apart from the fade', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.carousel[data-ready]')).toBeAttached();
  // Expressive Code makes a block that scrolls focusable after the page loads.
  await page.waitForFunction(() =>
    [...document.querySelectorAll('pre')].every((pre) => pre.scrollWidth <= pre.clientWidth || pre.tabIndex === 0),
  );
  // Expressive Code gives each block the same landmark name, which is an upstream issue.
  const { violations } = await new AxeBuilder({ page }).include('main').disableRules(['landmark-unique']).analyze();
  const contrast = violations.find((v) => v.id === 'color-contrast');
  const other = violations.filter((v) => v.id !== 'color-contrast');
  expect(other.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
  for (const node of contrast?.nodes ?? []) expect(node.html).toMatch(/scb-focus-out|scb-mention/);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('shows the first example and links each button to its page', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('.carousel .slide').first()).toBeVisible();
    await expect(page.locator('.carousel .slide').nth(1)).toBeHidden();
    await expect(page.locator('.carousel .rotation')).toBeHidden();
    const link = page.locator('.carousel a.tile', { hasText: 'Focus' });
    await expect(link).toHaveAttribute('href', '/starlight-codeblocks/features/focus/');
    await expect(page.locator('.carousel a.tile')).toHaveCount(24);
  });
});
