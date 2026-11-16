import { expect, type Locator, type Page, test } from '@playwright/test';
import type { CodeblocksOptions } from '../../packages/starlight-codeblocks/src/options.ts';
import { render } from '../../packages/starlight-codeblocks/test/render.ts';
import { clipboard } from './helpers.ts';

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

test('a permalink to a collapsed line expands the block, even past a heading with the same id or a malformed address', async ({
  page,
}) => {
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));
  await page.goto('./features/line-permalinks/#%E0%A4%A');
  await page.evaluate(() => {
    location.hash = '#cfg-L%E0';
  });
  await page.waitForTimeout(200);
  expect(errors).toEqual([]);
  const block = await inject(page, ['```js id="combo" expandable={3}', ...eight, '```'], '#combo-L7');
  await expect(page.locator('#combo-L7')).toBeVisible();
  await expect(page.locator('#combo-L7')).toHaveClass(/scb-permalink-target/);
  await expect(block.locator('.scb-expandable-toggle')).toHaveAttribute('aria-expanded', 'true');
  const again = await inject(page, ['```js id="combo" expandable={3}', ...eight, '```']);
  await page.evaluate(() => {
    const heading = document.createElement('h2');
    heading.id = 'combo';
    document.getElementById('combined')?.prepend(heading);
    location.hash = '#combo-L8';
  });
  await expect(page.locator('#combo-L8')).toHaveClass(/scb-permalink-target/);
  await expect(again.locator('.scb-expandable-toggle')).toHaveAttribute('aria-expanded', 'true');
});

test('expanding shows the hidden lines, their markers and callouts, and a callout on a hidden line shows with it', async ({
  page,
}) => {
  const block = await inject(page, ['```js title="a.js" hidden={6-7} expandable={3}', ...eight, '```']);
  await block.locator('.scb-hidden-toggle').click();
  await expect(block.locator('.scb-hidden-line').first()).toBeVisible();
  await expect(block.locator('.scb-expandable-toggle')).toHaveAttribute('aria-expanded', 'true');
  const collapsed = await inject(page, [
    '```js expandable={3}',
    ...eight.slice(0, 5),
    'f() // [!code hide]',
    '// [!callout /g/] Calls g.',
    ...eight.slice(6),
    '```',
  ]);
  await expect(collapsed.locator('.scb-expandable-toggle')).toHaveAttribute('aria-expanded', 'false');
  await expect(collapsed.locator('.scb-hidden-marker')).toBeHidden();
  await expect(collapsed.locator('.scb-callout')).toBeHidden();
  await collapsed.locator('.scb-expandable-toggle').click();
  await expect(collapsed.locator('.scb-hidden-marker')).toBeVisible();
  await expect(collapsed.locator('.scb-callout')).toBeVisible();
  const hiddenLine = await inject(page, [
    '```js',
    'a()',
    '// [!callout /b/] Calls b.',
    'b() // [!code hide]',
    'c()',
    '```',
  ]);
  await expect(hiddenLine.locator('.scb-callout')).toBeHidden();
  await hiddenLine.locator('.scb-hidden-marker').click();
  await expect(hiddenLine.locator('.scb-callout')).toBeVisible();
  await hiddenLine.locator('.scb-hidden-marker').click();
  await expect(hiddenLine.locator('.scb-callout')).toBeHidden();
});

test('a split diff counts each side of a block with line permalinks from its first number, and the links say it', async ({
  page,
}) => {
  const block = await inject(page, [
    '```diff lang="js" id="srv" startLineNumber=0',
    ' a()',
    '-b()',
    '+c()',
    ' d()',
    '```',
  ]);
  const numbers = (side: string) => block.locator(`.scb-split-${side} .scb-permalink`).allTextContents();
  const added = block.locator('.ec-line.ins .scb-permalink');
  await block.getByRole('button', { name: 'Split' }).click();
  expect(await numbers('left')).toEqual(['0', '1', '2']);
  expect(await numbers('right')).toEqual(['0', '1', '2']);
  await expect(added).toHaveAttribute('aria-label', 'Link to line 1');
  await added.click();
  await expect(block.locator('.scb-permalink-target')).toHaveClass(/\bins\b/);
  expect(page.url()).toMatch(/#srv-L2$/);
  const copy = block.locator('.scb-split-copy').last();
  await expect(copy.locator('.scb-permalink')).toHaveAttribute('tabindex', '-1');
  await copy.locator('.scb-permalink').click();
  expect(page.url()).toMatch(/#srv-L3$/);
  const target = block.locator('.scb-permalink-target');
  await expect(target).toContainText('d()');
  const background = (line: Locator) => line.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(await background(copy)).toBe(await background(target));
  expect(await background(copy)).not.toBe(await background(block.locator('.scb-split-copy').first()));
  await block.getByRole('button', { name: 'Unified' }).click();
  await expect(added).toHaveText('2');
  await expect(added).toHaveAttribute('aria-label', 'Link to line 2');
});

test('a split diff keeps a callout above its line on its side, and collapses by row', async ({ page }) => {
  const block = await inject(page, [
    '```js',
    'a()',
    'b() // [!code --]',
    '// [!callout /c/] Calls c.',
    'c() // [!code ++]',
    'd()',
    '```',
  ]);
  await block.getByRole('button', { name: 'Split' }).click();
  const box = (selector: string) => block.locator(selector).boundingBox();
  const [del, ins, callout] = [await box('.ec-line.del'), await box('.ec-line.ins'), await box('.scb-callout')];
  expect(ins?.y).toBe(del?.y);
  expect(callout?.x).toBeGreaterThanOrEqual(ins?.x ?? 0);
  expect((callout?.y ?? 0) + (callout?.height ?? 0)).toBeLessThanOrEqual((ins?.y ?? 0) + 1);

  const collapsed = await inject(page, [
    // The first block stored the split view, which a synced block would start in.
    '```diff lang="js" expandable={3} splitDiff.sync=false',
    ' a()',
    '-b()',
    '-c()',
    '+d()',
    '+e()',
    ' f()',
    ' g()',
    ' h()',
    '```',
  ]);
  const line = (text: string) => collapsed.locator('.ec-line:not(.scb-split-copy)', { hasText: text });
  await expect(line('d()')).toBeHidden();
  await collapsed.getByRole('button', { name: 'Split' }).click();
  await expect(line('d()')).toBeVisible();
  await expect(line('e()')).toBeVisible();
  await expect(line('f()')).toBeHidden();
  await collapsed.getByRole('button', { name: 'Unified' }).click();
  await expect(line('d()')).toBeHidden();
  await expect(line('c()')).toBeVisible();
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

test("a Run button and Copy commands use the reader's placeholder values", async ({ page }) => {
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
  const shell = await inject(page, ['```sh placeholder="MY_APP"', '$ cd MY_APP', 'ok', '```']);
  await shell.getByRole('textbox', { name: 'MY_APP' }).fill('shop');
  await shell.getByRole('button', { name: 'Copy commands' }).click();
  await expect.poll(() => clipboard(page)).toBe('cd shop');
  await shell.locator('.copy button').click();
  await expect.poll(() => clipboard(page)).toBe('$ cd shop\nok');
});
