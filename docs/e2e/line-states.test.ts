import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./features/line-states/');
});

const example = (page: import('@playwright/test').Page, n = 0) =>
  page.locator('.example').nth(n).locator('.pane').nth(1).locator('.expressive-code');

test('tints each state and shows the messages as labels', async ({ page }) => {
  const block = example(page);
  await expect(block.locator('.scb-state-info')).toHaveCount(1);
  await expect(block.locator('.scb-state-error .scb-state-label')).toHaveText("Error SyntaxError: expected ':'");
  await expect(block.locator('.scb-state-warning .scb-state-label')).toHaveText('Warning Includes the script name');
  const bar = await block
    .locator('.scb-state-error .code')
    .evaluate((el) => [getComputedStyle(el).borderInlineStartWidth, getComputedStyle(el).borderInlineStartStyle]);
  expect(bar).toEqual(['3px', 'solid']);
});

test('gives screen readers the state name before the line', async ({ page }) => {
  const line = example(page).locator('.scb-state-error');
  await expect(line).toMatchAriaSnapshot(`- text: "Error: for name in sys.argv[1:] SyntaxError: expected ':'"`);
});

test('leaves the messages out of the copied text and of a manual selection', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const block = example(page);
  const expected = 'import sys\n\nfor name in sys.argv[1:]\n    print(name)\n\ncount = len(sys.argv)';
  await block.locator('.copy button').focus();
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(expected);
  const selected = await block.locator('pre code').evaluate((code) => {
    getSelection()?.selectAllChildren(code);
    return getSelection()?.toString();
  });
  expect(selected).not.toContain('Error');
  expect(selected).not.toContain('SyntaxError');
  expect(selected).not.toContain('Note');
});

test('renders the custom state of the site', async ({ page }) => {
  const line = example(page, 1).locator('.scb-state-todo');
  await expect(line.locator('.scb-state-label')).toHaveText('To do Check the body against a schema');
  await expect(line.locator('.scb-state-prefix')).toHaveText('To do:');
});
