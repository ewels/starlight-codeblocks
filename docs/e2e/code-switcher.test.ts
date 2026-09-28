import { expect, type Page, test } from '@playwright/test';
import { clipboard, css, output } from './helpers.ts';

const groups = (page: Page, n: number) => output(page, n).locator('.scb-switcher');
const visible = (page: Page, n: number, g = 0) => groups(page, n).nth(g).locator(':scope > .expressive-code:visible');

test.beforeEach(async ({ page }) => {
  await page.goto('./features/code-switcher/');
  // A change before the client module starts is lost.
  await expect(page.locator('[data-scb-code-switcher]:not([data-scb-ready])')).toHaveCount(0);
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

test('a line permalink into a hidden variant shows that variant, and keeps the saved choice', async ({ page }) => {
  await groups(page, 1)
    .nth(0)
    .locator(':scope > .expressive-code[hidden] .ec-line')
    .first()
    .dispatchEvent('beforematch');
  await expect(visible(page, 1, 0)).toContainText('readFile');
  expect(await page.evaluate(() => localStorage.getItem('scb-code-switcher:lang'))).toBeNull();
});

test('the icon left of the menu shows the language of the variant, and is hidden from screen readers', async ({
  page,
}) => {
  const icon = () => visible(page, 1, 0).locator('.scb-switcher-icon');
  await expect(icon()).toHaveAttribute('aria-hidden', 'true');
  const python = await icon().locator('path').getAttribute('d');
  await visible(page, 1, 0).getByRole('combobox').selectOption({ label: 'JavaScript' });
  expect(await icon().locator('path').getAttribute('d')).not.toBe(python);
  const [iconBox, menuBox] = await Promise.all([
    icon().boundingBox(),
    visible(page, 1, 0).getByRole('combobox').boundingBox(),
  ]);
  expect(iconBox && menuBox && iconBox.x - menuBox.x).toBeGreaterThanOrEqual(6);
  expect(await css(icon(), 'color')).toBe(await css(visible(page, 1, 0).getByRole('combobox'), 'color'));
});

test('the chevron keeps a gap from the right edge of the menu', async ({ page }) => {
  const field = visible(page, 0).locator('.scb-switcher-field');
  const [chevron, menu] = await Promise.all([
    field.locator('.scb-switcher-chevron').boundingBox(),
    field.getByRole('combobox').boundingBox(),
  ]);
  expect(chevron && menu && menu.x + menu.width - (chevron.x + chevron.width)).toBeGreaterThanOrEqual(6);
  const text = await field.getByRole('combobox').evaluate((el) => parseFloat(getComputedStyle(el).paddingInlineEnd));
  expect(text).toBeGreaterThanOrEqual(20);
});

test('the menu sits 8px from the end of the frame, with or without a title', async ({ page }) => {
  for (const block of [visible(page, 0), visible(page, 2)]) {
    const [frame, menu] = await Promise.all([
      block.locator('.frame').boundingBox(),
      block.getByRole('combobox').boundingBox(),
    ]);
    expect(frame && menu && Math.round(frame.x + frame.width - (menu.x + menu.width))).toBe(8);
  }
});

test('the menu keeps its background under the pointer', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Phones have no hover.');
  const menu = visible(page, 0).getByRole('combobox');
  const background = () => css(menu, 'backgroundColor');
  await page.mouse.move(0, 0);
  const rest = await background();
  await menu.hover();
  expect(await background()).toBe(rest);
});

test('a block without the saved label shows its first variant', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('scb-code-switcher:lang', 'Go'));
  await page.reload();
  await expect(visible(page, 1, 0)).toContainText('json.load');
});

test('the copy button copies the variant that shows', async ({ page }) => {
  await visible(page, 0).getByRole('combobox').selectOption({ label: 'Yarn' });
  await visible(page, 0).locator('.copy button').click();
  await expect.poll(() => clipboard(page)).toBe('yarn add starlight-codeblocks');
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

test('the first example uses the editor frame, with the menu in the middle of the bar', async ({ page }) => {
  const block = visible(page, 0);
  await expect(block.locator('figure')).not.toHaveClass(/is-terminal/);
  const { above, below } = await block.getByRole('combobox').evaluate((el) => {
    const bar = (el.closest('.header') as Element).getBoundingClientRect();
    const box = el.getBoundingClientRect();
    return { above: box.top - bar.top, below: bar.bottom - box.bottom };
  });
  expect(Math.abs(above - below)).toBeLessThan(0.5);
});
