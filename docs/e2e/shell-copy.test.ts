import { expect, type Page, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./features/smart-shell-copy/');
});

const example = (page: Page, n = 0) =>
  page.locator('.example').nth(n).locator('.pane').nth(1).locator('.expressive-code');

test('the copy button copies the commands only, with the keyboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const button = example(page).locator('.copy button');
  await expect(button).toHaveAttribute('title', 'Copy commands');
  await button.focus();
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    'uv tool install ruff\nruff check src/ \\\n    --fix',
  );
});

test('the copy button copies the commands with the pointer', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const block = example(page, 1);
  await block.hover();
  await block.locator('.copy button').click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    'Get-ChildItem -Name\nGet-Content summary.txt',
  );
});

test('prompts cannot be selected, and have their own colour', async ({ page }) => {
  const prompt = example(page).locator('.scb-shell-prompt').first();
  await expect(prompt).toHaveText('$ ');
  const style = await prompt.evaluate((el) => {
    const s = getComputedStyle(el);
    return { userSelect: s.userSelect, color: s.color };
  });
  expect(style.userSelect).toBe('none');
  const command = await example(page)
    .locator('.ec-line')
    .first()
    .locator('.code > span')
    .nth(1)
    .evaluate((el) => getComputedStyle(el).color);
  expect(style.color).not.toBe(command);
});

test('output lines draw every character in the muted colour', async ({ page }) => {
  const output = example(page).locator('.scb-shell-output').first().locator('.code');
  await expect(output).toHaveText('Resolved 1 package in 180ms');
  expect(await output.locator('span').count()).toBe(0);
  const colours = await example(page)
    .locator('.scb-shell-output .code')
    .evaluateAll((els) => els.map((el) => getComputedStyle(el).color));
  expect(new Set(colours).size).toBe(1);
});

test('a manual selection leaves out the prompts', async ({ page }) => {
  const text = await example(page)
    .locator('pre')
    .evaluate((pre) => {
      const range = document.createRange();
      range.selectNodeContents(pre);
      const selection = getSelection() as Selection;
      selection.removeAllRanges();
      selection.addRange(range);
      return selection.toString();
    });
  expect(text).not.toContain('$ ');
  expect(text).toContain('uv tool install ruff');
});
