import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const site = 'https://ewels.github.io/starlight-codeblocks/';
const sitemap = readFileSync(new URL('../dist/sitemap-0.xml', import.meta.url), 'utf8');
const pages = [...sitemap.matchAll(/<loc>[^<]*?\/starlight-codeblocks\/([^<]*)<\/loc>/g)].map(([, path]) => path ?? '');
const local = (url: string) => `./${url.slice(site.length)}`;

const oneProject = () =>
  test.skip(test.info().project.name !== 'desktop-light', 'The output is the same in every project.');

for (const path of pages) {
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
    expect(prose).not.toMatch(/^(import|export) |<Example|<\/?(Tabs|TabItem|Aside|Steps)\b/m);
  });
}

test('llms.txt lists the Markdown version of every page', async ({ request }) => {
  oneProject();
  const response = await request.get('./llms.txt');
  expect(response.status()).toBe(200);
  const text = await response.text();
  for (const path of pages) expect(text).toContain(`(${site}${path ? path.replace(/\/$/, '') : 'index'}.md)`);
});

test('llms-full.txt has every page', async ({ request }) => {
  oneProject();
  const text = await (await request.get('./llms-full.txt')).text();
  for (const path of pages) expect(text).toContain(`<!-- ${site}${path} -->`);
});

test('an example keeps its fence line in the Markdown', async ({ request }) => {
  oneProject();
  const markdown = await (await request.get('./features/focus.md')).text();
  expect(markdown).toContain('````md\n```js title="src/config.js" focus={4-7}\n');
});

test.describe('page actions', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('the copy button works with the keyboard and copies the Markdown', async ({ page, request }) => {
    await page.goto('./features/focus/');
    const actions = page.locator('.page-actions');
    const copy = actions.locator('button');
    await copy.focus();
    expect(await copy.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('solid');
    await page.keyboard.press('Enter');
    await expect(copy).toHaveText('Copied');
    await expect(actions.getByRole('status')).toHaveText('Copied the page as Markdown');
    const expected = await (await request.get('./features/focus.md')).text();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(expected);
    await expect(copy).toHaveText('Copy as Markdown', { timeout: 4000 });
  });

  test('Tab reaches every action, and each is at least 24 px high', async ({ page }) => {
    await page.goto('./features/focus/');
    const names = ['Copy as Markdown', 'View as Markdown', 'Open in Claude', 'Open in ChatGPT'];
    await page.locator('.page-actions button').focus();
    for (const name of names) {
      const focused = page.locator(':focus');
      await expect(focused).toHaveText(name);
      const box = await focused.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(24);
      expect(box?.width).toBeGreaterThanOrEqual(24);
      await page.keyboard.press('Tab');
    }
  });

  test('View as Markdown opens the Markdown version, and the assistant links name it', async ({ page }) => {
    await page.goto('./features/focus/');
    const prompt = `Read ${site}features/focus.md.`;
    for (const name of ['Open in Claude', 'Open in ChatGPT']) {
      const href = String(await page.getByRole('link', { name }).getAttribute('href'));
      expect(decodeURIComponent(href)).toContain(prompt);
    }
    await page.getByRole('link', { name: 'View as Markdown' }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/features\/focus\.md$/);
    expect(await page.locator('body').textContent()).toContain('# Focus');
  });

  test('pages that are not docs pages have no actions', async ({ page }) => {
    await page.goto('./does-not-exist/');
    await expect(page.locator('.page-actions')).toHaveCount(0);
  });
});
