import { expect, type Page, test } from '@playwright/test';
import { clipboard, css, output } from './helpers.ts';

const groups = (page: Page, n: number) => output(page, n).locator('.scb-switcher');
const visible = (page: Page, n: number, g = 0) => groups(page, n).nth(g).locator(':scope > .expressive-code:visible');

async function load(page: Page) {
  await page.goto('./features/code-switcher/');
  // A change before the client module starts is lost.
  await expect(page.locator('[data-scb-code-switcher]:not([data-scb-ready])')).toHaveCount(0);
}

test('the menu shows the chosen variant, remembers it, and switches synced blocks and titles', async ({ page }) => {
  await load(page);
  const menu = visible(page, 0).getByRole('combobox', { name: 'Variant' });
  await expect(visible(page, 0)).toHaveCount(1);
  await expect(visible(page, 0)).toContainText('npm install starlight-codeblocks');
  await expect(menu).toHaveValue('0');
  await menu.selectOption({ label: 'pnpm' });
  await expect(visible(page, 0)).toContainText('pnpm add starlight-codeblocks');
  await expect(visible(page, 0).getByRole('combobox')).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem('scb-code-switcher:pm'))).toBe('pnpm');
  await visible(page, 0).getByRole('combobox').selectOption({ label: 'Yarn' });
  await visible(page, 0).locator('.copy button').click();
  await expect.poll(() => clipboard(page)).toBe('yarn add starlight-codeblocks');

  const icon = () => visible(page, 1, 0).locator('.scb-switcher-icon path');
  const python = await icon().getAttribute('d');
  await visible(page, 1, 0).getByRole('combobox').selectOption({ label: 'JavaScript' });
  await expect(visible(page, 1, 0)).toContainText('readFile');
  await expect(visible(page, 1, 1)).toContainText('writeFile');
  await expect(visible(page, 1, 1).getByRole('combobox')).toHaveValue('1');
  expect(await icon().getAttribute('d')).not.toBe(python);

  await expect(visible(page, 2).locator('.title')).toHaveText('config.yml');
  await visible(page, 2).getByRole('combobox').selectOption({ label: 'TOML' });
  await expect(visible(page, 2).locator('.title')).toHaveText('config.toml');

  await page.reload();
  await expect(visible(page, 0)).toContainText('yarn add starlight-codeblocks');
});

test('works with the keyboard', async ({ page }) => {
  await load(page);
  const menu = visible(page, 0).getByRole('combobox');
  await menu.focus();
  // Type-ahead changes a closed menu on every platform. Arrow keys open it on macOS.
  await menu.press('p');
  await expect(visible(page, 0)).toContainText('pnpm add starlight-codeblocks');
  await expect(visible(page, 0).getByRole('combobox')).toBeFocused();
});

test('a block without the saved label shows its first variant, and a permalink into a hidden one shows it', async ({
  page,
}) => {
  await load(page);
  await page.evaluate(() => localStorage.setItem('scb-code-switcher:lang', 'Go'));
  await page.reload();
  await expect(visible(page, 1, 0)).toContainText('json.load');
  await groups(page, 1)
    .nth(0)
    .locator(':scope > .expressive-code[hidden] .ec-line')
    .first()
    .dispatchEvent('beforematch');
  await expect(visible(page, 1, 0)).toContainText('readFile');
  expect(await page.evaluate(() => localStorage.getItem('scb-code-switcher:lang'))).toBe('Go');
});

test('the menu, its icon and its chevron sit in the title bar', async ({ page, isMobile }) => {
  await load(page);
  const field = visible(page, 0).locator('.scb-switcher-field');
  const menu = field.getByRole('combobox');
  const [chevron, box] = await Promise.all([field.locator('.scb-switcher-chevron').boundingBox(), menu.boundingBox()]);
  expect(chevron && box && box.x + box.width - (chevron.x + chevron.width)).toBeGreaterThanOrEqual(6);
  expect(await menu.evaluate((el) => parseFloat(getComputedStyle(el).paddingInlineEnd))).toBeGreaterThanOrEqual(20);
  const { above, below } = await menu.evaluate((el) => {
    const bar = (el.closest('.header') as Element).getBoundingClientRect();
    const box = el.getBoundingClientRect();
    return { above: box.top - bar.top, below: bar.bottom - box.bottom };
  });
  expect(Math.abs(above - below)).toBeLessThan(0.5);

  for (const block of [visible(page, 0), visible(page, 2)]) {
    const [frame, menu] = await Promise.all([
      block.locator('.frame').boundingBox(),
      block.getByRole('combobox').boundingBox(),
    ]);
    expect(frame && menu && Math.round(frame.x + frame.width - (menu.x + menu.width))).toBe(8);
  }

  const icon = visible(page, 1, 0).locator('.scb-switcher-icon');
  const iconMenu = visible(page, 1, 0).getByRole('combobox');
  const [iconBox, iconMenuBox] = await Promise.all([icon.boundingBox(), iconMenu.boundingBox()]);
  expect(iconBox && iconMenuBox && iconBox.x - iconMenuBox.x).toBeGreaterThanOrEqual(6);
  expect(await css(icon, 'color')).toBe(await css(iconMenu, 'color'));

  if (!isMobile) {
    await page.mouse.move(0, 0);
    const rest = await css(menu, 'backgroundColor');
    await menu.hover();
    expect(await css(menu, 'backgroundColor')).toBe(rest);
  }
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
