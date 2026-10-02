import { expect, test } from '@playwright/test';
import { clipboard, css, example } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('./features/smart-shell-copy/');
});

const commands = 'uv tool install ruff\nruff check src/ \\\n    --fix';

test('Copy commands copies the commands only, with the keyboard, and keeps its width', async ({ page }) => {
  const button = example(page).locator('.scb-shell-copy');
  await expect(button).toHaveAccessibleName('Copy commands');
  const width = (await button.boundingBox())?.width;
  await button.focus();
  expect(await css(button, 'outlineStyle')).toBe('solid');
  await page.keyboard.press('Enter');
  await expect.poll(() => clipboard(page)).toBe(commands);
  await expect(button).toHaveText('Copied');
  expect((await button.boundingBox())?.width).toBe(width);
  await expect(example(page).locator('.scb-tools [aria-live="polite"]')).toHaveText('Copied');
  await expect(button).toHaveText('Copy commands', { timeout: 3000 });
});

test('prompts are not selected or copied by the button, and output is muted', async ({ page }) => {
  const block = example(page);
  const prompt = block.locator('.scb-shell-prompt').first();
  await expect(prompt).toHaveText('$ ');
  expect(await css(prompt, 'userSelect')).toBe('none');
  const command = await css(block.locator('.ec-line').first().locator('.code > span').nth(1), 'color');
  expect(await css(prompt, 'color')).not.toBe(command);
  const colours = await block
    .locator('.scb-shell-output .code')
    .evaluateAll((els) => els.map((el) => getComputedStyle(el).color));
  expect(new Set(colours).size).toBe(1);
  const text = await block.locator('pre').evaluate((pre) => {
    getSelection()?.selectAllChildren(pre);
    return getSelection()?.toString() ?? '';
  });
  expect(text).not.toContain('$ ');
  expect(text).toContain('uv tool install ruff');
  expect(text).toContain('Resolved 1 package');

  await block.hover();
  await block.locator('.copy button').click();
  await expect
    .poll(() => clipboard(page))
    .toBe(
      '$ uv tool install ruff\nResolved 1 package in 180ms\nInstalled 1 executable: ruff\n$ ruff check src/ \\\n    --fix\nFound 3 errors (3 fixed, 0 remaining).',
    );

  await expect(example(page, 3).locator('figure')).not.toHaveClass(/is-terminal/);
  await example(page, 3).getByRole('button', { name: 'Copy commands' }).click();
  await expect
    .poll(() => clipboard(page))
    .toBe(
      'from collections import Counter\ncounts = Counter(["ok", "ok", "failed"])\nfor status, n in counts.most_common():\n    print(f"{status:<8} {n}")\n',
    );
  await example(page, 1).getByRole('button', { name: 'Copy commands' }).click();
  await expect.poll(() => clipboard(page)).toBe('Get-ChildItem -Name\nGet-Content summary.txt');

  await block.evaluate((el) => {
    const copy = el.cloneNode(true) as HTMLElement;
    copy.id = 'scb-clone';
    document.body.append(copy);
  });
  await page.locator('#scb-clone').getByRole('button', { name: 'Copy commands' }).click();
  await expect.poll(() => clipboard(page)).toBe(commands);
  await expect(page.locator('#scb-clone').getByRole('button', { name: 'Copied' })).toBeVisible();
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the Copy commands button is hidden', async ({ page }) => {
    await expect(example(page).locator('.scb-shell-copy')).toBeHidden();
  });
});
