import { expect, type Page, test } from '@playwright/test';
import { clipboard, css, output } from './helpers.ts';

const groups = (page: Page, n: number) => output(page, n).locator('.scb-tabs');
const visible = (page: Page, n: number, g = 0) => groups(page, n).nth(g).locator(':scope > .expressive-code:visible');
const selected = (page: Page, n: number, g = 0) => visible(page, n, g).getByRole('tab', { selected: true });

async function load(page: Page) {
  await page.goto('./features/code-tabs/');
  // A change before the client module starts is lost.
  await expect(page.locator('[data-scb-code-tabs]:not([data-scb-ready])')).toHaveCount(0);
}

test('a tab shows its file, with focus on its tab, and the copy button copies it', async ({ page }) => {
  await load(page);
  const tabs = visible(page, 0).getByRole('tablist', { name: 'Variant' }).getByRole('tab');
  await expect(tabs).toHaveText(['.github/workflows/ci.yml', 'greet.py', 'greet.js']);
  await expect(tabs.locator('svg')).toHaveCount(3);
  await expect(selected(page, 0)).toHaveText('.github/workflows/ci.yml');
  await visible(page, 0).getByRole('tab', { name: 'greet.py' }).click();
  await expect(visible(page, 0)).toHaveCount(1);
  await expect(visible(page, 0).locator('pre')).toContainText('sys.argv');
  await expect(selected(page, 0)).toHaveText('greet.py');
  await expect(selected(page, 0)).toBeFocused();
  await visible(page, 0).locator('.copy button').click();
  await expect.poll(() => clipboard(page)).toContain('import sys');
});

test('label tabs have no icon, and synced blocks switch together and remember the choice', async ({ page }) => {
  await load(page);
  await expect(visible(page, 1).getByRole('tab')).toHaveText(['npm', 'pnpm', 'Yarn']);
  await expect(visible(page, 1).getByRole('tab').locator('svg')).toHaveCount(0);
  await visible(page, 1).getByRole('tab', { name: 'pnpm' }).click();
  await expect(visible(page, 1)).toContainText('pnpm add starlight-codeblocks');
  expect(await page.evaluate(() => localStorage.getItem('scb-code-tabs:pm'))).toBe('pnpm');

  await visible(page, 2, 0).getByRole('tab', { name: 'JavaScript' }).click();
  await expect(visible(page, 2, 0)).toContainText('readFile');
  await expect(visible(page, 2, 1)).toContainText('writeFile');
  await expect(selected(page, 2, 1)).toHaveText('JavaScript');

  await page.reload();
  await expect(visible(page, 1)).toContainText('pnpm add starlight-codeblocks');
  await expect(selected(page, 1)).toHaveText('pnpm');
});

test('the arrow keys, Home and End select tabs, and only the selected tab is in the tab order', async ({ page }) => {
  await load(page);
  const tab = (name: string) => visible(page, 0).getByRole('tab', { name });
  await expect(tab('greet.py')).toHaveAttribute('tabindex', '-1');
  await selected(page, 0).focus();
  await page.keyboard.press('ArrowRight');
  await expect(selected(page, 0)).toHaveText('greet.py');
  await expect(selected(page, 0)).toBeFocused();
  await page.keyboard.press('End');
  await expect(selected(page, 0)).toHaveText('greet.js');
  await page.keyboard.press('ArrowRight');
  await expect(selected(page, 0)).toHaveText('.github/workflows/ci.yml');
  await page.keyboard.press('ArrowLeft');
  await expect(selected(page, 0)).toHaveText('greet.js');
  await page.keyboard.press('Home');
  await expect(selected(page, 0)).toHaveText('.github/workflows/ci.yml');
  await expect(selected(page, 0)).toBeFocused();
});

test('inactive tabs read on the tab bar, with a focus ring', async ({ page }) => {
  await load(page);
  const tab = visible(page, 0).getByRole('tab', { name: 'greet.py' });
  const [colour, active] = await Promise.all([css(tab, 'color'), css(selected(page, 0), 'color')]);
  expect(colour).not.toBe(active);
  await selected(page, 0).focus();
  await page.keyboard.press('ArrowRight');
  expect(await css(selected(page, 0), 'outlineStyle')).toBe('solid');
});

test('a row of tabs wider than the block scrolls on its own', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await load(page);
  await visible(page, 0).getByRole('tab', { name: 'greet.js' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  const inView = await selected(page, 0).evaluate((tab) => {
    const list = (tab.parentElement as Element).getBoundingClientRect();
    const box = tab.getBoundingClientRect();
    return box.left >= list.left - 1 && box.right <= list.right + 1;
  });
  expect(inView).toBe(true);
});

test('a block without the saved label shows its first variant, and a permalink into a hidden one shows it', async ({
  page,
}) => {
  await load(page);
  await page.evaluate(() => localStorage.setItem('scb-code-tabs:lang', 'Go'));
  await page.reload();
  await expect(visible(page, 2, 0)).toContainText('json.load');
  await groups(page, 2)
    .nth(0)
    .locator(':scope > .expressive-code[hidden] .ec-line')
    .first()
    .dispatchEvent('beforematch');
  await expect(visible(page, 2, 0)).toContainText('readFile');
  expect(await page.evaluate(() => localStorage.getItem('scb-code-tabs:lang'))).toBe('Go');
});

test('the menu picks a variant from the keyboard, and sits in the title bar with its icon and chevron', async ({
  page,
  isMobile,
}) => {
  await load(page);
  const menu = visible(page, 3).getByRole('combobox', { name: 'Variant' });
  await menu.focus();
  // Type-ahead changes a closed menu on every platform. Arrow keys open it on macOS.
  await menu.press('t');
  await expect(visible(page, 3).locator('.title')).toHaveText('config.toml');
  await expect(visible(page, 3).getByRole('combobox')).toBeFocused();

  const field = visible(page, 3).locator('.scb-tabs-field');
  const [chevron, box] = await Promise.all([field.locator('.scb-tabs-chevron').boundingBox(), menu.boundingBox()]);
  expect(chevron && box && box.x + box.width - (chevron.x + chevron.width)).toBeGreaterThanOrEqual(6);
  expect(await menu.evaluate((el) => parseFloat(getComputedStyle(el).paddingInlineEnd))).toBeGreaterThanOrEqual(20);
  const { above, below } = await menu.evaluate((el) => {
    const bar = (el.closest('.header') as Element).getBoundingClientRect();
    const box = el.getBoundingClientRect();
    return { above: box.top - bar.top, below: bar.bottom - box.bottom };
  });
  expect(Math.abs(above - below)).toBeLessThan(0.5);
  const frame = await visible(page, 3).locator('.frame').boundingBox();
  const end = await menu.boundingBox();
  expect(frame && end && Math.round(frame.x + frame.width - (end.x + end.width))).toBe(8);

  const icon = field.locator('.scb-tabs-icon');
  const iconBox = await icon.boundingBox();
  expect(iconBox && end && iconBox.x - end.x).toBeGreaterThanOrEqual(6);
  expect(await css(icon, 'color')).toBe(await css(menu, 'color'));

  if (!isMobile) {
    await page.mouse.move(0, 0);
    const rest = await css(menu, 'backgroundColor');
    await menu.hover();
    expect(await css(menu, 'backgroundColor')).toBe(rest);
  }
});

test('without JavaScript, the first variant shows with its own tab, and no other tabs or menu', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('./features/code-tabs/');
  await expect(visible(page, 0)).toHaveCount(1);
  await expect(visible(page, 0).locator('.header .title')).toHaveText('.github/workflows/ci.yml');
  await expect(page.locator('.scb-tabs [role="tab"]')).toHaveCount(0);
  await expect(visible(page, 1).locator('.header .title')).toHaveText('npm');
  await expect(groups(page, 3).locator('select').first()).toBeHidden();
  await context.close();
});
