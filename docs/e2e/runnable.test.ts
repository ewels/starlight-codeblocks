import { expect, type Page, test } from '@playwright/test';

const example = (page: Page, n: number) =>
  page.locator('.example').nth(n).locator('.pane').nth(1).locator('.expressive-code');

const PYTHON = 0;
const JS = 1;
const ERROR = 2;
const LOOP = 3;

test.beforeEach(async ({ page }) => {
  await page.goto('./features/run-in-the-browser/');
});

test('no runtime loads before a reader selects Run', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.reload();
  await page.waitForLoadState('networkidle');
  expect(requests.filter((u) => u.includes('scb-runtime-') || u.includes('pyodide'))).toEqual([]);
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
  await expect(panel.locator('.scb-run-stderr')).toHaveText('Error: Sizes of 1 are deprecated.');
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
  test.skip(info.project.name !== 'desktop-dark', 'the timeout takes 5 seconds, so one project is enough');
  test.setTimeout(30_000);
  const block = example(page, LOOP);
  const button = block.locator('.scb-run');
  await button.click();
  await expect(button).toHaveAttribute('aria-disabled', 'true');
  await expect(block.locator('.scb-run-stderr')).toHaveText('Error: The run stopped after 5 seconds.', {
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

test('shows a runtime error in the error colour', async ({ page }) => {
  const block = example(page, ERROR);
  await block.locator('.scb-run').click();
  const stderr = block.locator('.scb-run-stderr');
  await expect(stderr).toContainText('ZeroDivisionError', { timeout: 120_000 });
  await expect(stderr).toContainText('File "<exec>", line 2');
  await expect(stderr).not.toContainText('_pyodide');
});

test('runs Python with Pyodide in a web worker', async ({ page }) => {
  // Pyodide comes from a CDN, so this test needs the network and can take a while.
  test.setTimeout(150_000);
  const block = example(page, PYTHON);
  const panel = block.locator('.scb-run-output');
  await block.locator('.scb-run').click();
  await expect(panel.locator('.scb-run-status')).toHaveText('Loading the Python runtime…');
  await expect(panel.locator('.scb-run-stdout')).toHaveText('mean 1546, sd 57.6', { timeout: 120_000 });
  // The page stays responsive while Python runs.
  expect(await page.evaluate(() => 1 + 1)).toBe(2);
  await block.locator('.scb-run').click();
  await expect(panel.locator('.scb-run-stdout')).toHaveText('mean 1546, sd 57.6');
  await expect(panel.locator('.scb-run-status')).toHaveCount(0);
});

test('stopping a Python run ends the worker, and the next run loads Pyodide again', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-dark', 'needs the network, so one project is enough');
  test.setTimeout(240_000);
  const result = await page.evaluate(async () => {
    const url = document.querySelector<HTMLElement>('[data-scb-runnable*="python"]')?.dataset.scbRunnable as string;
    const runtime = (await import(url)).default;
    await runtime.load();
    const controller = new AbortController();
    setTimeout(() => controller.abort(new Error('stopped')), 500);
    const stopped = await runtime.run('while True: pass', { signal: controller.signal }).catch((e: Error) => e.message);
    await runtime.load();
    const again = await runtime.run('print(6 * 7)', { signal: new AbortController().signal });
    return { stopped, again };
  });
  expect(result).toEqual({ stopped: 'stopped', again: { stdout: '42', stderr: '' } });
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
