import { expect, test } from '@playwright/test';
import { clipboard, css, example } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('./features/smart-shell-copy/');
});

const commands = 'uv tool install ruff\nruff check src/ \\\n    --fix';

test('Copy commands copies the commands only, with the keyboard', async ({ page }) => {
  const button = example(page).locator('.scb-shell-copy');
  await expect(button).toHaveAccessibleName('Copy commands');
  await button.focus();
  expect(await css(button, 'outlineStyle')).toBe('solid');
  await page.keyboard.press('Enter');
  await expect.poll(() => clipboard(page)).toBe(commands);
  await expect(button).toHaveText('Copied');
  await expect(example(page).locator('.scb-tools [aria-live="polite"]')).toHaveText('Copied');
  await expect(button).toHaveText('Copy commands', { timeout: 3000 });
});

test('Copy commands copies the commands with the pointer', async ({ page }) => {
  await example(page, 2).getByRole('button', { name: 'Copy commands' }).click();
  await expect.poll(() => clipboard(page)).toBe('Get-ChildItem -Name\nGet-Content summary.txt');
});

test('Copy commands keeps its width while it shows Copied', async ({ page }) => {
  const button = example(page).locator('.scb-shell-copy');
  await expect(button).toHaveAccessibleName('Copy commands');
  const before = (await button.boundingBox())?.width;
  await button.click();
  await expect(button).toHaveText('Copied');
  expect((await button.boundingBox())?.width).toBe(before);
});

test('the copy button copies the whole block, prompts and output included', async ({ page }) => {
  const block = example(page);
  const button = block.locator('.copy button');
  await expect(button).toHaveAttribute('title', 'Copy to clipboard');
  await block.hover();
  await button.click();
  await expect
    .poll(() => clipboard(page))
    .toBe(
      '$ uv tool install ruff\nResolved 1 package in 180ms\nInstalled 1 executable: ruff\n$ ruff check src/ \\\n    --fix\nFound 3 errors (3 fixed, 0 remaining).',
    );
});

test('Copy commands works in a copy of the block', async ({ page }) => {
  await example(page).evaluate((el) => {
    const copy = el.cloneNode(true) as HTMLElement;
    copy.id = 'scb-clone';
    document.body.append(copy);
  });
  await page.locator('#scb-clone').getByRole('button', { name: 'Copy commands' }).click();
  await expect.poll(() => clipboard(page)).toBe(commands);
  await expect(page.locator('#scb-clone').getByRole('button', { name: 'Copied' })).toBeVisible();
});

test('prompts cannot be selected, and have their own colour', async ({ page }) => {
  const prompt = example(page).locator('.scb-shell-prompt').first();
  await expect(prompt).toHaveText('$ ');
  const style = await prompt.evaluate((el) => {
    const s = getComputedStyle(el);
    return { userSelect: s.userSelect, color: s.color };
  });
  expect(style.userSelect).toBe('none');
  const command = await css(example(page).locator('.ec-line').first().locator('.code > span').nth(1), 'color');
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

test('a manual selection includes the output lines', async ({ page }) => {
  const text = await example(page)
    .locator('pre')
    .evaluate((pre) => {
      getSelection()?.selectAllChildren(pre);
      return getSelection()?.toString() ?? '';
    });
  expect(text).toContain('Resolved 1 package');
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the Copy commands button is hidden', async ({ page }) => {
    await expect(example(page).locator('.scb-shell-copy')).toBeHidden();
  });
});

test('a Python session keeps the editor frame, and Copy commands copies its commands', async ({ page }) => {
  const block = example(page, 1);
  await expect(block.locator('figure')).not.toHaveClass(/is-terminal/);
  await expect(block.locator('.scb-shell-prompt').first()).toHaveText('>>> ');
  await expect(block.locator('.ec-line.scb-shell-output')).toHaveCount(2);
  await block.getByRole('button', { name: 'Copy commands' }).click();
  await expect
    .poll(() => clipboard(page))
    .toBe(
      'from collections import Counter\ncounts = Counter(["ok", "ok", "failed"])\nfor status, n in counts.most_common():\n    print(f"{status:<8} {n}")\n',
    );
});
