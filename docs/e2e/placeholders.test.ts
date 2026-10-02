import { expect, type Page, test } from '@playwright/test';
import { clipboard, copyFromKeyboard, css, once, output, serveClient } from './helpers.ts';

const token = (page: Page) => output(page).getByRole('textbox', { name: 'YOUR_TOKEN' });

test('typing fills every field, the copied code and the playground link, and Escape clears them', async ({ page }) => {
  await page.goto('./features/fill-in-placeholders/');
  const field = token(page).first();
  const empty = (await field.boundingBox())?.width ?? 0;
  expect(await css(field, 'transitionDuration')).toBe('0s');
  const [own, parent] = await token(page)
    .nth(1)
    .evaluate((el) => [getComputedStyle(el).color, getComputedStyle(el.parentElement as Element).color]);
  const plain = await css(
    output(page).locator('.expressive-code').nth(1).locator('.ec-line').first().locator('.code'),
    'color',
  );
  expect(own).toBe(parent);
  expect(own).not.toBe(plain);

  await field.click();
  await page.keyboard.type('tok_123');
  await expect(token(page).nth(1)).toHaveValue('tok_123');
  const blocks = output(page).locator('.expressive-code');
  const copied = await copyFromKeyboard(blocks.nth(0));
  expect(copied).toBe(
    'curl -H "Authorization: Bearer tok_123" \\\n  https://api.example.com/workspaces/WORKSPACE_ID/runs',
  );
  expect(await copyFromKeyboard(blocks.nth(1))).toBe('from example import Client\n\nclient = Client(token="tok_123")');
  const manual = async (select: (pre: HTMLElement) => void) => {
    await blocks.nth(0).locator('pre').evaluate(select);
    await page.keyboard.press('ControlOrMeta+c');
    return clipboard(page);
  };
  expect(await manual((pre) => getSelection()?.selectAllChildren(pre))).toBe(copied);
  expect(
    await manual((pre) => getSelection()?.selectAllChildren(pre.querySelectorAll('.ec-line')[1] as HTMLElement)),
  ).toBe('  https://api.example.com/workspaces/WORKSPACE_ID/runs');

  await field.focus();
  await page.keyboard.press('Escape');
  await expect(field).toHaveValue('');
  await expect(token(page).nth(1)).toHaveValue('');

  await field.fill('tok');
  expect((await field.boundingBox())?.width).toBeCloseTo(empty, 0);
  await field.fill('a-much-longer-token-value');
  expect((await field.boundingBox())?.width ?? 0).toBeGreaterThan(empty * 2);

  const link = output(page, 1).locator('a.scb-playground');
  const playgroundField = output(page, 1).getByRole('textbox', { name: 'YOUR_TOKEN' });
  await playgroundField.press('Escape');
  const before = (await link.getAttribute('href')) as string;
  await playgroundField.fill('tok_saved');
  await expect(link).not.toHaveAttribute('href', before);

  await page.reload();
  await expect(token(page).nth(1)).toHaveValue('tok_saved');
  await output(page, 1).getByRole('textbox', { name: 'YOUR_TOKEN' }).press('Escape');
  await expect(link).toHaveAttribute('href', before);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('fields are plain inputs that do not update each other', async ({ page }) => {
    await page.goto('./features/fill-in-placeholders/');
    await token(page).first().fill('tok_123');
    await expect(token(page).nth(1)).toHaveValue('');
  });
});

test.describe('storage option', () => {
  test.beforeEach(once);
  const origin = 'http://codeblocks-storage.test';
  const key = (page: Page) => page.getByRole('textbox', { name: 'MY KEY' });
  const stored = (page: Page) =>
    page.evaluate(() => [sessionStorage.getItem('scb-placeholders'), localStorage.getItem('scb-placeholders')]);
  const serve = (page: Page, storage: string, extra = '') =>
    serveClient(
      page,
      origin,
      'placeholders',
      `<figure data-scb-placeholders="${storage}"><input class="scb-placeholder" placeholder="MY KEY" aria-label="MY KEY">${extra}</figure>
      <script type="module">import init from '/placeholders.js'; init();</script>`,
    );

  test('storage="none" saves nothing, and custom playgrounds get the value in a URL and a form field', async ({
    page,
  }) => {
    await serve(
      page,
      'none',
      `<a class="scb-playground" href="https://example.com/?code=${encodeURIComponent('key = "MY KEY"')}">Open</a>
      <form class="scb-playground"><input type="hidden" name="code" value='key = "MY KEY"'></form>
      <div class="copy"><button data-code='key = "MY KEY"'></button></div>`,
    );
    await page.goto(`${origin}/`);
    await key(page).fill('a&b c');
    await expect(page.locator('a.scb-playground')).toHaveAttribute(
      'href',
      `https://example.com/?code=${encodeURIComponent('key = "a&b c"')}`,
    );
    await expect(page.locator('input[name="code"]')).toHaveValue('key = "a&b c"');
    await expect(page.locator('.copy button')).toHaveAttribute('data-code', 'key = "a&b c"');
    expect(await stored(page)).toEqual([null, null]);
    await page.reload();
    await expect(key(page)).toHaveValue('');
  });

  test('storage="session" saves the value in sessionStorage only, and it survives a reload', async ({ page }) => {
    await serve(page, 'session');
    await page.goto(`${origin}/`);
    await key(page).fill('tok_123');
    const [session, local] = await stored(page);
    expect(session).toContain('tok_123');
    expect(local).toBeNull();
    await page.reload();
    await expect(key(page)).toHaveValue('tok_123');
  });

  test('the default local storage keeps the value across a full navigation to another page', async ({ page }) => {
    await serve(page, 'local');
    await page.goto(`${origin}/a`);
    await key(page).fill('tok_123');
    await page.goto(`${origin}/b`);
    await expect(key(page)).toHaveValue('tok_123');
  });
});
