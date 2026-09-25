import { expect, type Page, test } from '@playwright/test';

const groups = (page: Page, n: number) =>
  page.locator('.example').nth(n).locator('.pane').nth(1).locator('.scb-switcher');
const visible = (page: Page, n: number, g = 0) => groups(page, n).nth(g).locator(':scope > .expressive-code:visible');

test.beforeEach(async ({ page }) => {
  await page.goto('./features/code-switcher/');
});

test('shows the first variant, with a menu in the title bar', async ({ page }) => {
  await expect(visible(page, 0)).toHaveCount(1);
  await expect(visible(page, 0)).toContainText('npm install starlight-codeblocks');
  await expect(visible(page, 0).getByRole('combobox', { name: 'Variant' })).toHaveValue('0');
});

test('selecting an entry shows its variant, keeps focus on the menu and remembers the choice', async ({ page }) => {
  await visible(page, 0).getByRole('combobox').selectOption({ label: 'pnpm' });
  await expect(visible(page, 0)).toContainText('pnpm add starlight-codeblocks');
  await expect(visible(page, 0).getByRole('combobox')).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem('scb-code-switcher:pm'))).toBe('pnpm');
  await page.reload();
  await expect(visible(page, 0)).toContainText('pnpm add starlight-codeblocks');
});

test('works with the keyboard', async ({ page }) => {
  const menu = visible(page, 0).getByRole('combobox');
  await menu.focus();
  // Type-ahead changes a closed menu on every platform. Arrow keys open it on macOS.
  await menu.press('p');
  await expect(visible(page, 0)).toContainText('pnpm add starlight-codeblocks');
  await expect(visible(page, 0).getByRole('combobox')).toBeFocused();
});

test('blocks with the same sync key switch together', async ({ page }) => {
  await visible(page, 1, 0).getByRole('combobox').selectOption({ label: 'JavaScript' });
  await expect(visible(page, 1, 0)).toContainText('readFile');
  await expect(visible(page, 1, 1)).toContainText('writeFile');
  await expect(visible(page, 1, 1).getByRole('combobox')).toHaveValue('1');
});

test('a block without the saved label shows its first variant', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('scb-code-switcher:lang', 'Rust'));
  await page.reload();
  await expect(visible(page, 1, 0)).toContainText('json.load');
});

test('the copy button copies the variant that shows', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await visible(page, 0).getByRole('combobox').selectOption({ label: 'Yarn' });
  await visible(page, 0).locator('.copy button').click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('yarn add starlight-codeblocks');
});

test('a variant with a title shows it in the title bar', async ({ page }) => {
  await expect(visible(page, 2).locator('.title')).toHaveText('config.yml');
  await visible(page, 2).getByRole('combobox').selectOption({ label: 'TOML' });
  await expect(visible(page, 2).locator('.title')).toHaveText('config.toml');
});

test('without JavaScript, the first variant shows and the menu is hidden', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('./features/code-switcher/');
  await expect(visible(page, 0)).toHaveCount(1);
  await expect(visible(page, 0)).toContainText('npm install');
  await expect(groups(page, 0).locator('select').first()).toBeHidden();
  await context.close();
});
