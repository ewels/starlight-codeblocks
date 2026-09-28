import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { unlisted } from '../src/sidebar.mjs';
import { clipboard, css, sitePages } from './helpers.ts';

const site = 'https://ewels.github.io/starlight-codeblocks/';
const listed = sitePages.filter((path) => !unlisted.includes(path.replace(/\/$/, '')));
const local = (url: string) => `./${url.slice(site.length)}`;

const oneProject = () =>
  test.skip(test.info().project.name !== 'desktop-light', 'The output is the same in every project.');

for (const path of sitePages) {
  test(`/${path} links to a Markdown version that exists`, async ({ page, request }) => {
    oneProject();
    await page.goto(`./${path}`);
    const alternate = page.locator('link[rel="alternate"][type="text/markdown"]');
    await expect(alternate).toHaveCount(1);
    const href = String(await alternate.getAttribute('href'));
    expect(href).toBe(`${site}${path ? path.replace(/\/$/, '') : 'index'}.md`);
    const response = await request.get(local(href));
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/markdown');
    const markdown = await response.text();
    expect(markdown).toMatch(/^# \S/);
    const prose = markdown.replace(/^\s*(`{3,})[^\n]*\n[\s\S]*?^\s*\1$/gm, '');
    expect(prose).not.toMatch(/^(import|export) |^\s*<\/?(Example|Tabs|TabItem|Aside|Steps)\b/m);
  });
}

test('llms.txt lists the Markdown version of every page', async ({ request }) => {
  oneProject();
  const response = await request.get('./llms.txt');
  expect(response.status()).toBe(200);
  const text = await response.text();
  for (const path of listed) expect(text).toContain(`(${site}${path ? path.replace(/\/$/, '') : 'index'}.md)`);
});

test('llms-full.txt has every page', async ({ request }) => {
  oneProject();
  const text = await (await request.get('./llms-full.txt')).text();
  for (const path of listed) expect(text).toContain(`<!-- ${site}${path} -->`);
});

test('the agent skill page has every skill file, on the page and in its Markdown', async ({ page, request }) => {
  oneProject();
  const skill = new URL('../../skills/starlight-codeblocks/', import.meta.url);
  const files = ['SKILL.md', ...readdirSync(new URL('references/', skill)).map((file) => `references/${file}`)];
  const markdown = await (await request.get('./guides/agent-skill.md')).text();
  await page.goto('./guides/agent-skill/');
  for (const file of files) {
    expect(markdown).toContain(readFileSync(new URL(file, skill), 'utf8').trim());
    await expect(page.locator('.expressive-code .title', { hasText: new RegExp(`^${file}$`) })).toHaveCount(1);
  }
});

test('an example keeps its fence line in the Markdown', async ({ request }) => {
  oneProject();
  const markdown = await (await request.get('./features/focus.md')).text();
  expect(markdown).toContain('````md\n```js title="src/config.js" focus={4-7}\n');
});

test.describe('page actions', () => {
  test('the copy button works with the keyboard and copies the Markdown', async ({ page, request }) => {
    await page.goto('./features/focus/');
    const actions = page.locator('.page-actions');
    const copy = actions.locator('.split-button-main');
    await copy.focus();
    expect(await css(copy, 'outlineStyle')).toBe('solid');
    await page.keyboard.press('Enter');
    await expect(copy).toHaveText('Copied');
    await expect(actions.getByRole('status')).toHaveText('Copied the page as Markdown');
    const expected = await (await request.get('./features/focus.md')).text();
    expect(await clipboard(page)).toBe(expected);
    await expect(copy).toHaveText('Copy as Markdown', { timeout: 4000 });
  });

  test('Tab reaches the split button, and each part is at least 24 px', async ({ page }) => {
    await page.goto('./features/focus/');
    const names = ['Copy as Markdown', 'More page actions'];
    await page.locator('.split-button-main').focus();
    for (const name of names) {
      const focused = page.locator(':focus');
      await expect(focused).toHaveAccessibleName(name);
      const box = await focused.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(24);
      expect(box?.width).toBeGreaterThanOrEqual(24);
      await page.keyboard.press('Tab');
    }
  });

  test('the caret opens a menu with the keyboard, arrow keys move between items, Escape closes it', async ({
    page,
  }) => {
    await page.goto('./features/focus/');
    const caret = page.locator('.split-button-caret');
    const menu = page.getByRole('menu', { name: 'Page actions' });
    await caret.focus();
    await expect(caret).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('Enter');
    await expect(caret).toHaveAttribute('aria-expanded', 'true');
    await expect(menu).toBeVisible();
    const items = ['View as Markdown', 'Open in Claude', 'Open in ChatGPT'];
    for (const name of items) {
      const focused = page.locator(':focus');
      await expect(focused).toHaveAccessibleName(name);
      const box = await focused.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(24);
      expect(box?.width).toBeGreaterThanOrEqual(24);
      await page.keyboard.press('ArrowDown');
    }
    await expect(page.locator(':focus')).toHaveAccessibleName(items[0] ?? '');
    await page.keyboard.press('ArrowUp');
    await expect(page.locator(':focus')).toHaveAccessibleName(items[items.length - 1] ?? '');
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(caret).toBeFocused();
    await expect(caret).toHaveAttribute('aria-expanded', 'false');
  });

  test('clicking outside the open menu closes it', async ({ page }) => {
    await page.goto('./features/focus/');
    const caret = page.locator('.split-button-caret');
    const menu = page.getByRole('menu', { name: 'Page actions' });
    await caret.click();
    await expect(menu).toBeVisible();
    await page.locator('h1').click();
    await expect(menu).toBeHidden();
  });

  test('the menu links point at the Markdown page and the assistants, and open the Markdown page', async ({ page }) => {
    await page.goto('./features/focus/');
    const prompt = `Read ${site}features/focus.md.`;
    await page.locator('.split-button-caret').click();
    for (const name of ['Open in Claude', 'Open in ChatGPT']) {
      const href = String(await page.getByRole('menuitem', { name }).getAttribute('href'));
      expect(decodeURIComponent(href)).toContain(prompt);
    }
    await page.getByRole('menuitem', { name: 'View as Markdown' }).click();
    await expect(page).toHaveURL(/\/features\/focus\.md$/);
    expect(await page.locator('body').textContent()).toContain('# Focus');
  });

  test('pages that are not docs pages have no actions', async ({ page }) => {
    await page.goto('./does-not-exist/');
    await expect(page.locator('.page-actions')).toHaveCount(0);
  });

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('the actions show as plain links, with no copy button and no menu', async ({ page }) => {
      await page.goto('./features/focus/');
      await expect(page.locator('.split-button')).toBeHidden();
      const fallback = page.locator('.page-actions-fallback');
      for (const name of ['View as Markdown', 'Open in Claude', 'Open in ChatGPT']) {
        await expect(fallback.getByRole('link', { name })).toBeVisible();
      }
    });
  });
});

for (const path of sitePages) {
  test(`/${path} has a share card of 1200 × 630 px`, async ({ page, request }) => {
    oneProject();
    await page.goto(`./${path}`);
    const image = String(await page.locator('meta[property="og:image"]').getAttribute('content'));
    expect(image).toBe(`${site}og/${path ? path.replace(/\/$/, '') : 'index'}.png`);
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', image);
    const response = await request.get(local(image));
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('image/png');
    const png = await response.body();
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  });
}
