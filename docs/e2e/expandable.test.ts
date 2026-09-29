import { expect, test } from '@playwright/test';
import { css, example } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('./features/expandable-blocks/');
});

test('collapses a long block under a fade, and the button or find in page opens it', async ({ page }) => {
  const block = example(page);
  const pre = block.locator('pre');
  const lines = block.locator('.ec-line');
  const button = block.locator('.scb-expandable-toggle');
  await expect(lines.nth(20)).toBeHidden();
  await expect(pre).toHaveClass(/scb-expandable-collapsed/);

  const { gap, fade, line } = await pre.evaluate((el) => {
    const lines = [...el.querySelectorAll<HTMLElement>('.ec-line')].filter((l) => !l.hidden);
    const last = lines[lines.length - 1].getBoundingClientRect();
    return {
      gap: el.getBoundingClientRect().bottom - last.bottom,
      fade: Number.parseFloat(getComputedStyle(el, '::after').height),
      line: last.height,
    };
  });
  expect(gap).toBeLessThan(2);
  expect(fade / line).toBeGreaterThan(2);

  const style = (sel: string) =>
    block.locator(sel).evaluate((el) => {
      const s = getComputedStyle(el);
      const { backgroundColor: bg, borderTopWidth: top, borderBottomWidth: bottom, borderLeftWidth: left } = s;
      return { bg, top, bottom, left, radius: s.borderBottomLeftRadius };
    });
  const [preStyle, bar] = [await style('pre'), await style('.scb-expandable-bar')];
  expect(bar.bg).toBe(preStyle.bg);
  expect(bar.top).toBe('0px');
  expect(bar.left).toBe(preStyle.left);
  expect(bar.bottom).toBe(preStyle.left);
  expect(preStyle.radius).toBe('0px');
  expect(bar.radius).not.toBe('0px');

  await expect(button).toHaveText('Show all 24 lines');
  await button.click();
  await expect(button).toHaveText('Show fewer lines');
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  await expect(lines.nth(20)).toBeVisible();
  await expect(pre).not.toHaveClass(/scb-expandable-collapsed/);
  expect(await css(pre, 'transitionDuration')).toBe('0s');
  await button.click();
  await expect(button).toHaveText('Show all 24 lines');
  await expect(lines.nth(20)).toBeHidden();

  // window.find() skips until-found content, so this checks what the browser's find bar relies on.
  const found = pre.locator('.ec-line', { hasText: 'csv.DictReader(fh)' });
  await expect(found).toHaveAttribute('hidden', 'until-found');
  expect(await css(found, 'display')).not.toBe('none');
  await found.dispatchEvent('beforematch');
  await expect(found).toBeVisible();
  await expect(pre).not.toHaveClass(/scb-expandable-collapsed/);
});

test('prints in full, and works with the keyboard', async ({ page }) => {
  const pre = example(page).locator('pre');
  const button = example(page).locator('.scb-expandable-toggle');
  await expect(pre.locator('.ec-line').nth(20)).toBeHidden();
  await page.emulateMedia({ media: 'print' });
  await expect(example(page).locator('.scb-expandable-bar')).toBeHidden();
  expect(await pre.evaluate((el) => getComputedStyle(el, '::after').display)).toBe('none');
  await expect(pre.locator('.ec-line').last()).toBeVisible();
  await page.emulateMedia({ media: 'screen' });

  await button.focus();
  await page.keyboard.press('Enter');
  await expect(button).toHaveAttribute('aria-expanded', 'true');
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('the block shows in full, with no button', async ({ page }) => {
    const block = example(page);
    await expect(block.locator('.scb-expandable-bar')).toBeHidden();
    await expect(block.locator('.ec-line').last()).toBeVisible();
  });
});
