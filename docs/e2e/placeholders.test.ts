import { readdirSync, readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./features/fill-in-placeholders/');
});

const example = (page: Page, n = 0) => page.locator('.example').nth(n).locator('.pane').nth(1);
const token = (page: Page) => example(page).getByRole('textbox', { name: 'YOUR_TOKEN' });

async function copied(page: Page, block: ReturnType<Page['locator']>) {
  await block.locator('.copy button').focus();
  await page.keyboard.press('Enter');
  return page.evaluate(() => navigator.clipboard.readText());
}

test('typing in one field fills every field with the same text, and the copied code', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await token(page).first().click();
  await page.keyboard.type('tok_123');
  await expect(token(page).nth(1)).toHaveValue('tok_123');
  const blocks = example(page).locator('.expressive-code');
  expect(await copied(page, blocks.nth(0))).toBe(
    'curl -H "Authorization: Bearer tok_123" \\\n  https://api.example.com/workspaces/WORKSPACE_ID/runs',
  );
  expect(await copied(page, blocks.nth(1))).toBe('from example import Client\n\nclient = Client(token="tok_123")');
});

test('a field is as wide as its text or its value', async ({ page }) => {
  const field = token(page).first();
  const empty = (await field.boundingBox())?.width ?? 0;
  await field.fill('tok');
  expect((await field.boundingBox())?.width).toBeCloseTo(empty, 0);
  await field.fill('a-much-longer-token-value');
  expect((await field.boundingBox())?.width ?? 0).toBeGreaterThan(empty * 2);
});

test('Escape clears the value in every field', async ({ page }) => {
  await token(page).first().fill('tok_123');
  await token(page).first().focus();
  await page.keyboard.press('Escape');
  await expect(token(page).first()).toHaveValue('');
  await expect(token(page).nth(1)).toHaveValue('');
});

test('values come back when the page loads again', async ({ page }) => {
  await token(page).first().fill('tok_saved');
  await page.reload();
  await expect(token(page).nth(1)).toHaveValue('tok_saved');
});

test('a field draws its text in the colour of its token', async ({ page }) => {
  const field = token(page).nth(1);
  const [own, parent] = await field.evaluate((el) => [
    getComputedStyle(el).color,
    getComputedStyle(el.parentElement as Element).color,
  ]);
  const plain = await example(page)
    .locator('.expressive-code')
    .nth(1)
    .locator('.ec-line')
    .first()
    .locator('.code')
    .evaluate((el) => getComputedStyle(el).color);
  expect(own).toBe(parent);
  expect(own).not.toBe(plain);
});

test('the TS Playground link gets the value', async ({ page }) => {
  const block = example(page, 2);
  const link = block.locator('a.scb-playground');
  const before = await link.getAttribute('href');
  await block.getByRole('textbox', { name: 'YOUR_TOKEN' }).fill('tok_123');
  await expect(link).not.toHaveAttribute('href', before as string);
  await block.getByRole('textbox', { name: 'YOUR_TOKEN' }).press('Escape');
  await expect(link).toHaveAttribute('href', before as string);
});

test('the field changes instantly, with or without reduced motion', async ({ page }) => {
  expect(
    await token(page)
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe('0s');
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('fields are plain inputs that do not update each other', async ({ page }) => {
    await token(page).first().fill('tok_123');
    await expect(token(page).nth(1)).toHaveValue('');
  });
});

test.describe('custom playgrounds', () => {
  const origin = 'http://codeblocks.test';
  const dir = new URL('../../packages/starlight-codeblocks/dist/client/', import.meta.url);
  const file = readdirSync(dir).find((name) => name.startsWith('scb-placeholders.')) as string;
  const html = `<figure data-scb-placeholders="none">
    <input class="scb-placeholder" data-ph="MY KEY" placeholder="MY KEY" aria-label="MY KEY">
    <a class="scb-playground" href="https://example.com/?code=${encodeURIComponent('key = "MY KEY"')}">Open</a>
    <form class="scb-playground"><input type="hidden" name="code" value='key = "MY KEY"'></form>
    <div class="copy"><button data-code='key = "MY KEY"'></button></div>
  </figure>
  <script type="module">import init from '/placeholders.js'; init();</script>`;

  test('get the value in a URL and in a form field', async ({ page }) => {
    await page.route(`${origin}/**`, (route) =>
      route.request().url().endsWith('.js')
        ? route.fulfill({ body: readFileSync(new URL(file, dir), 'utf8'), contentType: 'text/javascript' })
        : route.fulfill({ body: html, contentType: 'text/html' }),
    );
    await page.goto(`${origin}/`);
    await page.getByRole('textbox', { name: 'MY KEY' }).fill('a&b c');
    await expect(page.locator('a.scb-playground')).toHaveAttribute(
      'href',
      `https://example.com/?code=${encodeURIComponent('key = "a&b c"')}`,
    );
    await expect(page.locator('input[name="code"]')).toHaveValue('key = "a&b c"');
    await expect(page.locator('.copy button')).toHaveAttribute('data-code', 'key = "a&b c"');
  });
});

test('a manual copy gives the same text as the copy button, and a part of it for a part', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await token(page).first().click();
  await page.keyboard.type('tok_123');
  const block = example(page).locator('.expressive-code').first();
  const manual = async (select: (pre: HTMLElement) => void) => {
    await block.locator('pre').evaluate(select);
    await page.keyboard.press('ControlOrMeta+c');
    return page.evaluate(() => navigator.clipboard.readText());
  };
  expect(await manual((pre) => getSelection()?.selectAllChildren(pre))).toBe(await copied(page, block));
  expect(
    await manual((pre) => getSelection()?.selectAllChildren(pre.querySelectorAll('.ec-line')[1] as HTMLElement)),
  ).toBe('  https://api.example.com/workspaces/WORKSPACE_ID/runs');
});
