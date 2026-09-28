import { expect, type Page, test } from '@playwright/test';
import { copyFromKeyboard, css, example } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('./features/api-auto-linking/');
});

const card = (page: Page, n = 0) => example(page, n).locator('.scb-api-card');

test('links the names that the imports bind, and nothing else', async ({ page }) => {
  const links = example(page).locator('a.scb-api-link');
  await expect(links).toHaveText(['json', 'pathlib', 'Path', 'json.loads', 'Path', 'read_text']);
  await expect(links.nth(3)).toHaveAttribute('href', 'https://docs.python.org/3/library/json.html#json.loads');
  await expect(links.nth(5)).toHaveAttribute(
    'href',
    'https://docs.python.org/3/library/pathlib.html#pathlib.Path.read_text',
  );
  await expect(example(page).getByText('print')).not.toHaveAttribute('href');
});

test('the link keeps its token colours, with a dotted underline that turns solid on hover', async ({ page }) => {
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
  await link.hover();
  const after = await style();
  expect(after.style).toBe('solid');
  expect(after.underline).not.toBe(before.underline);
});

test('hovering shows the card after a short delay, and moving away hides it', async ({ page }) => {
  const link = example(page).locator('a.scb-api-link').nth(3);
  // With room below, the card opens under the link.
  await link.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await link.hover();
  await expect(card(page)).toBeVisible();
  await expect(card(page)).toHaveText('function json.loadsPython 3.14 documentation');
  const l = await link.boundingBox();
  const c = await card(page).boundingBox();
  expect(c && l && c.y).toBeGreaterThanOrEqual((l?.y ?? 0) + (l?.height ?? 0));
  await page.mouse.move(5, 5);
  await expect(card(page)).toBeHidden();
});

test('the card is 360px wide, centred under its link, and 12px inside the viewport', async ({ page }) => {
  const width = page.viewportSize()?.width ?? 0;
  for (const name of ['FASTQC', 'channel.fromFilePairs']) {
    const link = example(page, 1).getByRole('link', { name }).first();
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
});

test('readers can move the pointer onto the card', async ({ page }) => {
  await example(page).locator('a.scb-api-link').nth(3).hover();
  await expect(card(page)).toBeVisible();
  await card(page).hover();
  await page.waitForTimeout(400);
  await expect(card(page)).toBeVisible();
});

test('keyboard focus shows the card at once, and Escape hides it', async ({ page }) => {
  const links = example(page).locator('a.scb-api-link');
  await links.nth(4).focus();
  await expect(card(page)).toHaveText('class pathlib.PathPython 3.14 documentation');
  await page.keyboard.press('Tab');
  await expect(links.nth(5)).toBeFocused();
  await expect(card(page).locator('.scb-api-card-head')).toHaveText('method pathlib.Path.read_text');
  expect(await css(links.nth(5), 'outlineStyle')).toBe('solid');
  await page.keyboard.press('Escape');
  await expect(card(page)).toBeHidden();
  await expect(links.nth(5)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(card(page)).toBeHidden();
});

test('the card has the signature and summary when the adapter gives them', async ({ page }) => {
  const link = example(page, 1).getByRole('link', { name: 'channel.fromFilePairs' });
  await link.focus();
  await expect(card(page, 1).locator('.scb-api-card-head')).toHaveText(
    'channel.fromFilePairs(pattern: String, [opts]) -> Channel<?>',
  );
  await expect(card(page, 1).locator('.scb-api-card-summary')).toHaveText(
    'Creates a channel that emits the file pairs that match a glob pattern, grouped by their shared prefix.',
  );
  await expect(card(page, 1).locator('.scb-api-card-source')).toHaveText('Nextflow reference');
  await expect(example(page, 1).getByRole('link', { name: 'FASTQC' }).first()).toHaveAttribute(
    'href',
    'https://nf-co.re/modules/fastqc',
  );
});

test('the card is inside the block, so it gets the theme colours, and fits a phone screen', async ({ page }) => {
  await example(page).locator('a.scb-api-link').nth(3).focus();
  const box = await card(page).boundingBox();
  const width = page.viewportSize()?.width ?? 0;
  expect(box?.x).toBeGreaterThanOrEqual(12);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width - 12);
  const colours = await card(page).evaluate((el) => ({
    background: getComputedStyle(el).backgroundColor,
    source: getComputedStyle(el.querySelector('.scb-api-card-source') as Element).color,
  }));
  expect(colours.background).not.toBe('rgba(0, 0, 0, 0)');
  expect(colours.source).not.toBe(colours.background);
});

test('screen readers get the card text as the description of the link', async ({ page }) => {
  const link = example(page, 1).getByRole('link', { name: 'channel.fromFilePairs' });
  await expect(link).toHaveAccessibleDescription(
    'channel.fromFilePairs(pattern: String, [opts]) -> Channel<?>. Creates a channel that emits the file pairs that match a glob pattern, grouped by their shared prefix. Nextflow reference.',
  );
  await link.hover();
  await expect(card(page, 1)).toHaveAttribute('aria-hidden', 'true');
});

test('the copied text is the code', async ({ page }) => {
  expect(await copyFromKeyboard(example(page))).toBe(
    'import json\nfrom pathlib import Path\n\nrun = json.loads(Path("run.json").read_text())\nprint(run["status"])',
  );
});

test('apiLinks=false leaves the block without links', async ({ page }) => {
  await expect(example(page, 3).locator('a.scb-api-link')).toHaveCount(0);
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

test.describe('links outside code blocks', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./extend/write-an-api-link-adapter/');
  });

  const outside = (page: Page) => page.locator('p[data-scb-api-links] a[data-scb-api-head]');

  test('get the card, with its text and the colours of the code block theme', async ({ page }) => {
    const link = outside(page);
    await link.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await link.hover();
    const card = page.locator('body > .scb-api-card.scb-page');
    await expect(card).toBeVisible();
    await expect(card.locator('span')).toHaveText([
      'class dict',
      'Create a new dictionary.',
      'Python 3 documentation',
      'Opens docs.python.org in a new tab.',
    ]);
    const outsideColours = await card.evaluate((el) => [
      getComputedStyle(el).backgroundColor,
      getComputedStyle(el).color,
    ]);
    expect(outsideColours[0]).not.toBe('rgba(0, 0, 0, 0)');
    // The same card inside a code block gets its colours from the block's theme variables.
    await page.locator('.expressive-code a.scb-api-link').first().focus();
    const inside = page.locator('.expressive-code .scb-api-card');
    await expect(inside).toBeVisible();
    expect(await inside.evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).color])).toEqual(
      outsideColours,
    );
  });

  test('open on keyboard focus and close with Escape', async ({ page }) => {
    await outside(page).focus();
    const card = page.locator('.scb-api-card');
    await expect(card).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(card).toBeHidden();
  });

  test('share one card with the links in code blocks', async ({ page }) => {
    await outside(page).focus();
    await expect(page.locator('.scb-api-card.scb-page')).toBeVisible();
    const inBlock = page.locator('.expressive-code a.scb-api-link').first();
    await inBlock.focus();
    await expect(page.locator('.expressive-code .scb-api-card:not(.scb-page)')).toBeVisible();
    expect(await page.locator('.scb-api-card').count()).toBe(1);
  });
});
