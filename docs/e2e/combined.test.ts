import { expect, type Page, test } from '@playwright/test';
import type { CodeblocksOptions } from '../../packages/starlight-codeblocks/src/options.ts';
import { render } from '../../packages/starlight-codeblocks/test/render.ts';

// Feature combinations that no docs example shows: the test renders the block and adds it to a built page,
// whose stylesheet has the styles of every feature, then starts the client modules the way a navigation does.
async function inject(page: Page, lines: string[], hash = '', options: CodeblocksOptions = {}) {
  const { html } = await render(lines.join('\n'), options);
  await page.goto('./features/expandable-blocks/');
  await page.evaluate(
    ([html, hash]) => {
      if (hash) history.replaceState(null, '', hash);
      const box = document.createElement('div');
      box.id = 'combined';
      box.innerHTML = html;
      document.querySelector('.sl-markdown-content')?.prepend(box);
      document.dispatchEvent(new Event('astro:page-load'));
    },
    [html, hash] as const,
  );
  return page.locator('#combined');
}

const eight = ['a()', 'b()', 'c()', 'd()', 'e()', 'f()', 'g()', 'h()'];

test('a permalink to a collapsed line expands the block', async ({ page }) => {
  const block = await inject(page, ['```js id="combo" expandable={3}', ...eight, '```'], '#combo-L7');
  await expect(page.locator('#combo-L7')).toBeVisible();
  await expect(page.locator('#combo-L7')).toHaveClass(/scb-permalink-target/);
  await expect(block.locator('.scb-expandable-toggle')).toHaveAttribute('aria-expanded', 'true');
});

test('collapsing hides the hidden-lines markers and callouts of the collapsed lines', async ({ page }) => {
  const block = await inject(page, [
    '```js expandable={3}',
    ...eight.slice(0, 5),
    'f() // [!code hide]',
    '// [!callout /g/] Calls g.',
    ...eight.slice(6),
    '```',
  ]);
  await expect(block.locator('.scb-expandable-toggle')).toHaveAttribute('aria-expanded', 'false');
  await expect(block.locator('.scb-hidden-marker')).toBeHidden();
  await expect(block.locator('.scb-callout')).toBeHidden();
  await block.locator('.scb-expandable-toggle').click();
  await expect(block.locator('.scb-hidden-marker')).toBeVisible();
  await expect(block.locator('.scb-callout')).toBeVisible();
});

test('a callout on a hidden line shows only with the line', async ({ page }) => {
  const block = await inject(page, ['```js', 'a()', '// [!callout /b/] Calls b.', 'b() // [!code hide]', 'c()', '```']);
  await expect(block.locator('.scb-callout')).toBeHidden();
  await block.locator('.scb-hidden-marker').click();
  await expect(block.locator('.scb-callout')).toBeVisible();
  await block.locator('.scb-hidden-marker').click();
  await expect(block.locator('.scb-callout')).toBeHidden();
});

test('a new page adds no second document or window listener', async ({ page }) => {
  await inject(page, [
    '```js id="nav" annotations="side"',
    'a() // [!annotate] Calls a.',
    '// [!ref] Calls b.',
    'b()',
    '```',
  ]);
  await expect(page.locator('[data-scb-annotations-ready]')).toBeAttached();
  await page.waitForTimeout(300);
  const added = await page.evaluate(async () => {
    // Astro's client router replaces the attributes of <html> and the page content on navigation.
    for (const { name } of [...document.documentElement.attributes]) {
      if (name.startsWith('data-scb')) document.documentElement.removeAttribute(name);
    }
    const box = document.getElementById('combined') as HTMLElement;
    const html = box.innerHTML.replaceAll(/ data-scb-[\w-]+-ready=""/g, '');
    box.innerHTML = html;
    const types: string[] = [];
    for (const target of [document, window] as EventTarget[]) {
      const original = target.addEventListener.bind(target);
      target.addEventListener = (type, listener, options) => {
        types.push(type);
        original(type, listener, options);
      };
    }
    document.dispatchEvent(new Event('astro:page-load'));
    await new Promise((resolve) => setTimeout(resolve, 500));
    return types;
  });
  expect(added.filter((type) => ['click', 'hashchange', 'resize'].includes(type))).toEqual([]);
});

test('a malformed address does not throw', async ({ page }) => {
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));
  await page.goto('./features/line-permalinks/#%E0%A4%A');
  await page.evaluate(() => {
    location.hash = '#cfg-L%E0';
  });
  await page.waitForTimeout(200);
  expect(errors).toEqual([]);
});

test("a Run button runs the code with the reader's placeholder values", async ({ page }) => {
  await page.route('**/scb-test-runtime.js', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: "export default { load: async () => {}, run: async (code) => ({ stdout: code, stderr: '' }) };",
    }),
  );
  const block = await inject(page, ['```js runnable placeholder="TOKEN"', 'TOKEN', '```'], '', {
    runnable: { runtimes: { javascript: '/scb-test-runtime.js' } },
  });
  await block.getByRole('textbox', { name: 'TOKEN' }).fill('abc123');
  await block.locator('.scb-run').click();
  await expect(block.locator('.scb-run-stdout')).toHaveText('abc123');
});
