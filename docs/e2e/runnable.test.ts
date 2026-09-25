import { expect, type Page, test } from '@playwright/test';

const example = (page: Page, n: number) =>
  page.locator('.example').nth(n).locator('.pane').nth(1).locator('.expressive-code');

const JS = 0;
const LOOP = 1;

test.beforeEach(async ({ page }) => {
  await page.goto('./features/run-in-the-browser/');
});

test('no runtime loads before a reader selects Run', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.reload();
  await page.waitForLoadState('networkidle');
  expect(requests.filter((u) => u.includes('scb-runtime-'))).toEqual([]);
  expect(requests.some((u) => u.includes('scb-runnable.'))).toBe(true);
});

test('the Run button runs the code and shows stdout and stderr', async ({ page }) => {
  const block = example(page, JS);
  const button = block.locator('.scb-run');
  const panel = block.locator('.scb-run-output');
  await expect(button).toHaveText('Run');
  await expect(panel).toBeEmpty();
  await expect(panel).toHaveAttribute('aria-live', 'polite');
  await button.click();
  await expect(panel.locator('.scb-run-label')).toHaveText('Output');
  await expect(panel.locator('.scb-run-stdout')).toHaveText('Total: 14');
  await expect(panel.locator('.scb-run-stderr')).toHaveText('Error: A warning');
  await expect(button).toHaveText('Run again');
  await expect(button).not.toHaveAttribute('aria-disabled');
});

test('works with the keyboard, and keeps the focus on the button', async ({ page }) => {
  const block = example(page, JS);
  const button = block.locator('.scb-run');
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(block.locator('.scb-run-stdout')).toHaveText('Total: 14');
  await expect(button).toBeFocused();
  await page.keyboard.press('Space');
  await expect(button).toHaveText('Run again');
  await expect(block.locator('.scb-run-stdout')).toHaveText('Total: 14');
});

test('the output colours meet the contrast target and differ for errors', async ({ page }) => {
  const block = example(page, JS);
  await block.locator('.scb-run').click();
  const stdout = block.locator('.scb-run-stdout');
  const stderr = block.locator('.scb-run-stderr');
  await expect(stdout).toBeVisible();
  const colour = (l: typeof stdout) => l.evaluate((el) => getComputedStyle(el).color);
  expect(await colour(stdout)).not.toBe(await colour(stderr));
  // Errors carry a bar as well as a colour.
  expect(await stderr.evaluate((el) => getComputedStyle(el).borderInlineStartWidth)).toBe('2px');
});

test('a run stops after the timeout, with a message', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-dark', 'the timeout takes 10 seconds, so one project is enough');
  test.setTimeout(30_000);
  const block = example(page, LOOP);
  const button = block.locator('.scb-run');
  await button.click();
  await expect(button).toHaveAttribute('aria-disabled', 'true');
  await expect(block.locator('.scb-run-stderr')).toHaveText('Error: The run stopped after 10 seconds.', {
    timeout: 15_000,
  });
  await expect(button).toHaveText('Run again');
  await expect(button).not.toHaveAttribute('aria-disabled');
});

test('runs the copied text as it is at the time of the click', async ({ page }) => {
  const block = example(page, JS);
  await block.locator('.copy button').evaluate((el: HTMLElement) => {
    el.dataset.code = "console.log('changed')";
  });
  await block.locator('.scb-run').click();
  await expect(block.locator('.scb-run-stdout')).toHaveText('changed');
});

test('without JavaScript, the Run button is hidden', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('./features/run-in-the-browser/');
  const block = example(page, JS);
  await expect(block.locator('.scb-run')).toBeHidden();
  await expect(block.locator('.header')).toBeHidden();
  await context.close();
});

test('the Run button does not print', async ({ page }) => {
  await page.emulateMedia({ media: 'print' });
  await expect(example(page, JS).locator('.scb-run')).toBeHidden();
});
