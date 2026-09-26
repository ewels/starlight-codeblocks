import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const site = 'https://ewels.github.io/starlight-codeblocks/';
const sitemap = readFileSync(new URL('../dist/sitemap-0.xml', import.meta.url), 'utf8');
const pages = [...sitemap.matchAll(/<loc>[^<]*?\/starlight-codeblocks\/([^<]*)<\/loc>/g)].map(([, path]) => path ?? '');
const local = (url: string) => `./${url.slice(site.length)}`;

test.beforeEach(() => {
  test.skip(test.info().project.name !== 'desktop-light', 'The output is the same in every project.');
});

for (const path of pages) {
  test(`/${path} links to a Markdown version that exists`, async ({ page, request }) => {
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
  const response = await request.get('./llms.txt');
  expect(response.status()).toBe(200);
  const text = await response.text();
  for (const path of pages) expect(text).toContain(`(${site}${path ? path.replace(/\/$/, '') : 'index'}.md)`);
});

test('llms-full.txt has every page', async ({ request }) => {
  const text = await (await request.get('./llms-full.txt')).text();
  for (const path of pages) expect(text).toContain(`<!-- ${site}${path} -->`);
});

test('an example keeps its fence line in the Markdown', async ({ request }) => {
  const markdown = await (await request.get('./features/focus.md')).text();
  expect(markdown).toContain('````md\n```js title="src/config.js" focus={4-7}\n');
});
