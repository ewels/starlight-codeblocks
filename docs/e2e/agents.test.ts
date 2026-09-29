import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { unlisted } from '../src/sidebar.mjs';
import { clipboard, css, sitePages } from './helpers.ts';

const site = 'https://ewels.github.io/starlight-codeblocks/';
const listed = sitePages.filter((path) => !unlisted.includes(path.replace(/\/$/, '')));
const local = (url: string) => `./${url.slice(site.length)}`;

const oneProject = () =>
  test.skip(test.info().project.name !== 'desktop-light', 'The output is the same in every project.');

const md = (path: string) => `${site}${path ? path.replace(/\/$/, '') : 'index'}.md`;
const attribute = (html: string, tag: RegExp, name: string) =>
  html.match(tag)?.[0].match(new RegExp(`${name}="([^"]*)"`))?.[1];

test('every page links to its Markdown version and its share card, and llms.txt lists them', async ({ request }) => {
  oneProject();
  const llms = await (await request.get('./llms.txt')).text();
  const full = await (await request.get('./llms-full.txt')).text();
  for (const path of listed) {
    expect.soft(llms).toContain(`(${md(path)})`);
    expect.soft(full).toContain(`<!-- ${site}${path} -->`);
  }
  // An example keeps its fence line in the Markdown.
  expect(await (await request.get('./features/focus.md')).text()).toContain(
    '````md\n```js title="src/config.js" focus={4-7}\n',
  );
  // Pages that are not docs pages have no actions.
  expect(await (await request.get('./does-not-exist/')).text()).not.toMatch(/class="[^"]*\bpage-actions\b/);

  for (const path of sitePages) {
    const html = await (await request.get(`./${path}`)).text();
    const alternates = html.match(/<link[^>]*rel="alternate"[^>]*type="text\/markdown"[^>]*>/g) ?? [];
    expect.soft(alternates, `/${path}`).toHaveLength(1);
    const href = attribute(html, /<link[^>]*rel="alternate"[^>]*type="text\/markdown"[^>]*>/, 'href');
    expect.soft(href, `/${path}`).toBe(md(path));
    const response = await request.get(local(String(href)));
    expect.soft(response.status(), String(href)).toBe(200);
    expect.soft(response.headers()['content-type']).toContain('text/markdown');
    const markdown = await response.text();
    // Front matter names the page, so that a copy read on its own says where it comes from.
    const [, front = ''] = markdown.match(/^---\n([\s\S]*?)\n---\n\n# \S/) ?? [];
    expect.soft(front, String(href)).toContain(`url: "${site}${path}"`);
    expect.soft(front, String(href)).toContain(`markdown: "${href}"`);
    expect
      .soft(front, String(href))
      .toMatch(/^context: "This page is from the documentation of starlight-codeblocks\./m);
    const prose = markdown.replace(/^\s*(`{3,})[^\n]*\n[\s\S]*?^\s*\1$/gm, '');
    expect.soft(prose, String(href)).not.toMatch(/^(import|export) |^\s*<\/?(Example|Tabs|TabItem|Aside|Steps)\b/m);

    const image = String(attribute(html, /<meta[^>]*property="og:image"[^>]*>/, 'content'));
    expect.soft(image, `/${path}`).toBe(`${site}og/${path ? path.replace(/\/$/, '') : 'index'}.png`);
    expect.soft(attribute(html, /<meta[^>]*name="twitter:image"[^>]*>/, 'content'), `/${path}`).toBe(image);
    const png = await request.get(local(image));
    expect.soft(png.status(), image).toBe(200);
    expect.soft(png.headers()['content-type']).toBe('image/png');
    const body = await png.body();
    expect.soft(body.subarray(1, 4).toString(), image).toBe('PNG');
    expect.soft([body.readUInt32BE(16), body.readUInt32BE(20)], image).toEqual([1200, 630]);
  }
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

test.describe('page actions', () => {
  test('the split button and its menu work with the keyboard, and the copy button copies the Markdown', async ({
    page,
    request,
  }) => {
    await page.goto('./features/focus/');
    const actions = page.locator('.page-actions');
    const copy = actions.locator('.split-button-main');
    const caret = page.locator('.split-button-caret');
    const menu = page.getByRole('menu', { name: 'Page actions' });
    const focused = page.locator(':focus');
    const expectTarget = async (name: string) => {
      await expect(focused).toHaveAccessibleName(name);
      const box = await focused.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(24);
      expect(box?.width).toBeGreaterThanOrEqual(24);
    };
    await copy.focus();
    expect(await css(copy, 'outlineStyle')).toBe('solid');
    await expectTarget('Copy as Markdown');
    await page.keyboard.press('Enter');
    await expect(copy).toHaveText('Copied');
    await expect(actions.getByRole('status')).toHaveText('Copied the page as Markdown');
    const expected = await (await request.get('./features/focus.md')).text();
    expect(await clipboard(page)).toBe(expected);

    await page.keyboard.press('Tab');
    await expectTarget('More page actions');
    await expect(caret).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('Enter');
    await expect(caret).toHaveAttribute('aria-expanded', 'true');
    await expect(menu).toBeVisible();
    const items = ['View as Markdown', 'Open in Claude', 'Open in ChatGPT'];
    for (const name of items) {
      await expectTarget(name);
      await page.keyboard.press('ArrowDown');
    }
    await expect(focused).toHaveAccessibleName(items[0] ?? '');
    await page.keyboard.press('ArrowUp');
    await expect(focused).toHaveAccessibleName(items.at(-1) ?? '');
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(caret).toBeFocused();
    await expect(caret).toHaveAttribute('aria-expanded', 'false');
    await expect(copy).toHaveText('Copy as Markdown', { timeout: 4000 });
  });

  test('the menu closes on a click outside, links to the assistants and opens the Markdown page', async ({ page }) => {
    await page.goto('./features/focus/');
    const caret = page.locator('.split-button-caret');
    const menu = page.getByRole('menu', { name: 'Page actions' });
    await caret.click();
    await expect(menu).toBeVisible();
    await page.locator('h1').click();
    await expect(menu).toBeHidden();
    await caret.click();
    const prompt = `Read ${site}features/focus.md.`;
    for (const name of ['Open in Claude', 'Open in ChatGPT']) {
      const href = String(await page.getByRole('menuitem', { name }).getAttribute('href'));
      expect(decodeURIComponent(href)).toContain(prompt);
    }
    await page.getByRole('menuitem', { name: 'View as Markdown' }).click();
    await expect(page).toHaveURL(/\/features\/focus\.md$/);
    expect(await page.locator('body').textContent()).toContain('# Focus');
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
