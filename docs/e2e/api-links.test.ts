import { expect, type Page, test } from '@playwright/test';
import { css, example } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('./features/api-auto-linking/');
});

const card = (page: Page, n = 0) => example(page, n).locator('.scb-api-card');

test('hovering shows the card under the link, the pointer can move onto it, and moving away hides it', async ({
  page,
}) => {
  const link = example(page).locator('a.scb-api-link').nth(3);
  const style = () =>
    link.evaluate((a) => {
      const s = getComputedStyle(a);
      return {
        line: s.textDecorationLine,
        style: s.textDecorationStyle,
        underline: s.textDecorationColor,
        first: getComputedStyle(a.firstElementChild as Element).color,
        last: getComputedStyle(a.lastElementChild as Element).color,
      };
    });
  const before = await style();
  expect(before.line).toBe('underline');
  expect(before.style).toBe('dotted');
  // `json.` and `loads` keep their own, different token colours inside the link.
  expect(before.first).not.toBe(before.last);
  // With room below, the card opens under the link.
  await link.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await link.hover();
  const after = await style();
  expect(after.style).toBe('solid');
  expect(after.underline).not.toBe(before.underline);
  await expect(card(page)).toBeVisible();
  await expect(card(page).locator('.scb-api-card-head')).toHaveText('function json.loads');
  // The summary comes from the live docs.python.org page, so its words can change.
  await expect(card(page).locator('.scb-api-card-summary')).not.toBeEmpty();
  await expect(card(page).locator('.scb-api-card-source')).toHaveText('Python 3.14 documentation');
  const l = await link.boundingBox();
  const c = await card(page).boundingBox();
  expect(c && l && c.y).toBeGreaterThanOrEqual((l?.y ?? 0) + (l?.height ?? 0));
  await card(page).hover();
  await page.waitForTimeout(400);
  await expect(card(page)).toBeVisible();
  await page.mouse.move(5, 5);
  await expect(card(page)).toBeHidden();
});

test('keyboard focus shows the card at once, and Escape hides it', async ({ page }) => {
  const links = example(page).locator('a.scb-api-link');
  await links.nth(4).focus();
  await expect(card(page).locator('.scb-api-card-head')).toHaveText('class pathlib.Path');
  await page.keyboard.press('Tab');
  await expect(links.nth(5)).toBeFocused();
  await expect(card(page).locator('.scb-api-card-head')).toHaveText('method pathlib.Path.read_text');
  await expect(card(page).locator('.scb-api-card-source svg[aria-hidden="true"] path')).toHaveAttribute('d', /^M/);
  expect(await css(links.nth(5), 'outlineStyle')).toBe('solid');
  // The card is inside the block, so it gets the theme colours.
  const colours = await card(page).evaluate((el) => ({
    background: getComputedStyle(el).backgroundColor,
    source: getComputedStyle(el.querySelector('.scb-api-card-source') as Element).color,
  }));
  expect(colours.background).not.toBe('rgba(0, 0, 0, 0)');
  expect(colours.source).not.toBe(colours.background);
  await page.keyboard.press('Escape');
  await expect(card(page)).toBeHidden();
  await expect(links.nth(5)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(card(page)).toBeHidden();
});

test('the card is 360px wide, centred under its link, 12px inside the viewport, with what the adapter gives', async ({
  page,
}) => {
  const width = page.viewportSize()?.width ?? 0;
  const pairs = example(page, 1).getByRole('link', { name: 'channel.fromFilePairs' });
  await expect(pairs).toHaveAccessibleDescription(
    'channel.fromFilePairs(pattern: String, [opts]) -> Channel<?>. Creates a channel that emits the file pairs that match a glob pattern, grouped by their shared prefix. Nextflow reference.',
  );
  const fastqc = example(page, 1).getByRole('link', { name: 'FASTQC' }).first();
  await expect(fastqc).toHaveAttribute('href', 'https://nf-co.re/modules/fastqc');
  for (const link of [fastqc, pairs]) {
    await link.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await link.focus();
    await expect(card(page, 1)).toBeVisible();
    const l = await link.boundingBox();
    const c = await card(page, 1).boundingBox();
    if (!l || !c) throw new Error('No link or card');
    expect(c.width).toBeCloseTo(Math.min(360, width - 24), 0);
    const centred = l.x + l.width / 2 - c.width / 2;
    expect(c.x).toBeCloseTo(Math.min(Math.max(12, centred), width - 12 - c.width), 0);
    expect(c.y - (l.y + l.height)).toBeCloseTo(8, 0);
  }
  await expect(card(page, 1).locator('.scb-api-card-head')).toHaveText(
    'channel.fromFilePairs(pattern: String, [opts]) -> Channel<?>',
  );
  await expect(card(page, 1).locator('.scb-api-card-summary')).toHaveText(
    'Creates a channel that emits the file pairs that match a glob pattern, grouped by their shared prefix.',
  );
  await expect(card(page, 1).locator('.scb-api-card-source')).toHaveText('Nextflow reference');
  await expect(card(page, 1).locator('.scb-api-card-source svg')).toHaveCount(1);
  // Screen readers get the card text as the link's description, not twice.
  await expect(card(page, 1)).toHaveAttribute('aria-hidden', 'true');
});

test('a page without API links does not load the module', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('./features/focus/');
  await page.waitForLoadState('networkidle');
  expect(requests.some((url) => url.includes('scb-api-links'))).toBe(false);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the links work, with no card', async ({ page }) => {
    const link = example(page).locator('a.scb-api-link').nth(3);
    await expect(link).toHaveAttribute('href', 'https://docs.python.org/3/library/json.html#json.loads');
    await link.hover();
    await expect(page.locator('.scb-api-card')).toHaveCount(0);
  });
});

test('links outside code blocks open the card on focus and hover, and share it with the links in blocks', async ({
  page,
}) => {
  await page.goto('./extend/write-an-api-link-adapter/');
  const outside = page.locator('p[data-scb-api-links] a[data-scb-api-head]');
  const pageCard = page.locator('body > .scb-api-card.scb-page');
  await outside.focus();
  await expect(pageCard).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(pageCard).toBeHidden();

  await outside.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await outside.hover();
  await expect(pageCard).toBeVisible();
  await expect(pageCard.locator('span')).toHaveText([
    'class dict',
    'Create a new dictionary.',
    'Python 3 documentation',
    'Opens docs.python.org in a new tab.',
  ]);
  const outsideColours = await pageCard.evaluate((el) => [
    getComputedStyle(el).backgroundColor,
    getComputedStyle(el).color,
  ]);
  expect(outsideColours[0]).not.toBe('rgba(0, 0, 0, 0)');
  // The same card inside a code block gets its colours from the block's theme variables.
  await page.locator('.expressive-code a.scb-api-link').first().focus();
  const inside = page.locator('.expressive-code .scb-api-card:not(.scb-page)');
  await expect(inside).toBeVisible();
  expect(await inside.evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).color])).toEqual(
    outsideColours,
  );
  expect(await page.locator('.scb-api-card').count()).toBe(1);
});
