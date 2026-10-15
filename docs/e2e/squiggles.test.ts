import { expect, test } from '@playwright/test';
import { copyFromKeyboard, css, example, phone, reduced } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('./features/squiggles/');
});

test('draws the wave under the text in the severity colour, and the copy button leaves out the messages', async ({
  page,
}) => {
  const block = example(page);
  const error = block.locator('.scb-squiggle-error');
  await expect(error).toHaveCount(1);
  const wave = await error.evaluate((el) => {
    const after = getComputedStyle(el, '::after');
    return { height: after.height, mask: after.maskImage, background: after.backgroundColor };
  });
  expect(wave.height).toBe('3px');
  expect(wave.mask).toContain('svg');
  expect(wave.background).not.toBe('rgba(0, 0, 0, 0)');
  expect(await copyFromKeyboard(block)).not.toContain('Cannot find');
});

test('keyboard focus opens the message above the text at once, and Escape closes it', async ({ page }) => {
  const block = example(page);
  const squiggle = block.locator('.scb-squiggle-error');
  const message = squiggle.locator('.scb-squiggle-popover');
  await expect(message).toBeHidden();
  await block.locator('.scb-squiggle-warning').focus();
  await page.keyboard.press('Tab');
  await expect(squiggle).toBeFocused();
  await expect(message).toBeVisible();
  await expect(message).toHaveText(/^ErrorCannot find name readFle\./);
  const [text, box] = await Promise.all([squiggle.boundingBox(), message.boundingBox()]);
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(text?.y ?? 0);
  // From the start of the text, as in VS Code. On a phone, the window edge can move it.
  if (!phone()) expect(Math.abs((box?.x ?? 0) - (text?.x ?? 0))).toBeLessThan(2);
  expect(box?.x ?? -1).toBeGreaterThanOrEqual(12);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual((page.viewportSize()?.width ?? 0) - 12);
  expect(await css(squiggle, 'outlineStyle')).toBe('solid');
  await page.keyboard.press('Escape');
  await expect(message).toBeHidden();
  await expect(squiggle).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(block.locator('.scb-squiggle-warning .scb-squiggle-popover')).toBeVisible();
  await expect(message).toBeHidden();
});

test.describe('hover', () => {
  test.skip(({ isMobile }) => isMobile, 'Phones have no hover.');

  test('hovering shows the message after a delay, and it stays while the pointer moves into it', async ({ page }) => {
    const block = example(page);
    const squiggle = block.locator('.scb-squiggle-warning');
    const message = squiggle.locator('.scb-squiggle-popover');
    await squiggle.hover();
    await page.waitForTimeout(100);
    await expect(message).toBeHidden();
    await expect(message).toBeVisible();
    if (reduced()) expect(await css(message, 'transitionDuration')).toBe('0s');
    await message.hover();
    await page.waitForTimeout(400);
    await expect(message).toBeVisible();
    await page.mouse.move(5, 5);
    await expect(message).toBeHidden();
  });

  test('Escape closes a hovered message until the pointer leaves', async ({ page }) => {
    const squiggle = example(page).locator('.scb-squiggle-error');
    const message = squiggle.locator('.scb-squiggle-popover');
    await squiggle.hover();
    await expect(message).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(message).toBeHidden();
    await page.mouse.move(5, 5);
    await squiggle.hover();
    await expect(message).toBeVisible();
  });

  test('after a click on the text, the message still closes when the pointer leaves', async ({ page }) => {
    const squiggle = example(page).locator('.scb-squiggle-error');
    const message = squiggle.locator('.scb-squiggle-popover');
    await squiggle.click();
    await expect(message).toBeVisible();
    await page.mouse.move(5, 5);
    await expect(message).toBeHidden();
  });

  test('a selection across the code leaves out an open message', async ({ page }) => {
    const squiggle = example(page).locator('.scb-squiggle-error');
    const message = squiggle.locator('.scb-squiggle-popover');
    const line = squiggle.locator('xpath=ancestor::div[contains(@class, "ec-line")]');
    const [from, over] = await Promise.all([line.boundingBox(), squiggle.boundingBox()]);
    if (!from || !over) throw new Error('No line');
    const y = from.y + from.height / 2;
    await page.mouse.move(from.x + 2, y);
    await page.mouse.down();
    await page.mouse.move(over.x + over.width / 2, y, { steps: 5 });
    await expect(message).toBeVisible();
    await page.mouse.move(from.x + from.width - 2, y, { steps: 5 });
    await page.mouse.up();
    const selected = await page.evaluate(() => getSelection()?.toString() ?? '');
    expect(selected).toContain('readFle');
    expect(selected).not.toContain('Cannot find');
  });
});

test('a tap on the text opens the message, and a tap somewhere else closes it', async ({ page }) => {
  test.skip(!phone(), 'Touch screens only.');
  const squiggle = example(page).locator('.scb-squiggle-error');
  const message = squiggle.locator('.scb-squiggle-popover');
  await squiggle.tap();
  await expect(message).toBeVisible();
  await page.locator('h1').tap();
  await expect(message).toBeHidden();
});

test('Escape in the message closes it and moves the focus back to the text', async ({ page }) => {
  const squiggle = example(page).locator('.scb-squiggle-error');
  const message = squiggle.locator('.scb-squiggle-popover');
  await squiggle.focus();
  await expect(message).toBeVisible();
  // Stands in for a link in the message.
  await message
    .locator('code')
    .first()
    .evaluate((el: HTMLElement) => {
      el.tabIndex = 0;
      el.focus();
    });
  await page.keyboard.press('Escape');
  await expect(message).toBeHidden();
  await expect(squiggle).toBeFocused();
});

test('a squiggle without a message names its severity', async ({ page }) => {
  const squiggle = example(page, 3).locator('.scb-squiggle-warning');
  await squiggle.focus();
  await expect(squiggle.locator('.scb-squiggle-popover')).toHaveText('Warning');
  await expect(squiggle.locator('.scb-sr-only')).toHaveText(' (Warning)');
});
