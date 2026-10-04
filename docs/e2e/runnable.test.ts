import { expect, test } from '@playwright/test';
import { css, example } from './helpers.ts';

const PYTHON = 0;
const JS = 1;
const TS = 2;
const PYPI = 3;
const PACKAGES = 4;
const ERROR = 5;
const LOOP = 6;
const SCRIPTED = 7;
const OUTPUT_ONLY = 8;
const TITLE = 9;

const oneProject = () =>
  test.skip(test.info().project.name !== 'desktop-dark', 'Slow or needs the network, so one project is enough.');

test.beforeEach(async ({ page }) => {
  await page.goto('./features/run-code/');
});

test('Run loads no runtime until selected, then shows stdout and stderr, and does not print', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.reload();
  await page.waitForLoadState('networkidle');
  expect(requests.filter((u) => u.includes('scb-runtime-') || u.includes('pyodide'))).toEqual([]);
  expect(requests.some((u) => u.includes('scb-runnable.'))).toBe(true);

  const block = example(page, JS);
  const button = block.locator('.scb-run');
  const panel = block.locator('.scb-run-output');
  const stdout = panel.locator('.scb-run-stdout');
  const stderr = panel.locator('.scb-run-stderr');
  await expect(button).toHaveText('Run code');
  await expect(panel).toBeEmpty();
  await expect(panel).toHaveAttribute('aria-live', 'polite');
  await button.click();
  await expect(panel.locator('.scb-run-label')).toHaveText('Output');
  await expect(stdout).toHaveText('Total: 14');
  await expect(stderr).toHaveText('Error: Sizes of 1 are deprecated.');
  await expect(button).toHaveText('Run again');
  await expect(button).not.toHaveAttribute('aria-disabled');
  expect(await css(stdout, 'color')).not.toBe(await css(stderr, 'color'));
  // Errors carry a bar as well as a colour.
  expect(await css(stderr, 'borderInlineStartWidth')).toBe('2px');

  // Runs the copied text as it is at the time of the click.
  await block.locator('.copy button').evaluate((el: HTMLElement) => {
    el.dataset.code = "console.log('changed')";
  });
  await button.click();
  await expect(stdout).toHaveText('changed');

  await page.emulateMedia({ media: 'print' });
  await expect(button).toBeHidden();
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

test('a run stops after the timeout, with a message', async ({ page }) => {
  oneProject();
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

test('runs Python with Pyodide in a web worker, shows its errors, and a stop ends the worker', async ({ page }) => {
  oneProject();
  test.setTimeout(240_000);
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

  const error = example(page, ERROR);
  await error.locator('.scb-run').click();
  const stderr = error.locator('.scb-run-stderr');
  await expect(stderr).toContainText('ZeroDivisionError', { timeout: 120_000 });
  await expect(stderr).toContainText('File "<exec>", line 2');
  await expect(stderr).not.toContainText('_pyodide');

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

test('runs TypeScript after removing the types, with no set-up', async ({ page }) => {
  const block = example(page, TS);
  await block.locator('.scb-run').click();
  await expect(block.locator('.scb-run-stdout')).toHaveText('2 samples, 3130 reads');
  await expect(block.locator('.scb-run-stderr')).toHaveCount(0);
});

test('installs Python packages from PyPI, by import name or from runnable.packages', async ({ page }) => {
  oneProject();
  test.setTimeout(240_000);
  const pypi = example(page, PYPI);
  await pypi.locator('.scb-run').click();
  await expect(pypi.locator('.scb-run-stdout')).toContainText('Sample', { timeout: 180_000 });
  await expect(pypi.locator('.scb-run-stdout')).toContainText('1610');
  const named = example(page, PACKAGES);
  await named.locator('.scb-run').click();
  await expect(named.locator('.scb-run-stdout')).toHaveText('hello-world-run-code', { timeout: 120_000 });
});

test('the button sits under the block, or in the title bar with runnable.button', async ({ page }) => {
  await expect(example(page, JS).locator('.scb-run-controls .scb-run')).toBeVisible();
  await expect(example(page, JS).locator('.header .scb-run')).toHaveCount(0);
  const title = example(page, TITLE);
  await expect(title.locator('.header .scb-run')).toBeVisible();
  await expect(title.locator('.scb-run-controls')).toHaveCount(0);
});

test('scripted output prints a line at a time, and runs no runtime', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  const block = example(page, SCRIPTED);
  const button = block.locator('.scb-run');
  const stdout = block.locator('.scb-run-stdout');
  await expect(block.locator('pre')).toHaveText('nextflow run hello.nf');
  await button.click();
  await expect(button).toHaveAttribute('aria-disabled', 'true');
  await expect(stdout).toHaveText(/^N E X T F L O W/);
  await expect(stdout).not.toContainText('Hola mundo!');
  await expect(stdout).toHaveText(/Launching hello\.nf[\s\S]*Hola mundo!$/, { timeout: 8_000 });
  await expect(button).toHaveText('Run again');
  expect(requests.filter((u) => u.includes('scb-runtime-'))).toEqual([]);
});

test('an output-only block has the button in its code area, which fades out on click', async ({ page }) => {
  const block = example(page, OUTPUT_ONLY);
  const start = block.locator('pre .scb-run-start');
  await expect(start).toBeVisible();
  await expect(block.locator('.copy, .scb-run-controls')).toHaveCount(0);
  await start.focus();
  await page.keyboard.press('Enter');
  await expect(block.locator('pre')).toBeHidden();
  await expect(block.locator('.scb-run-output')).toBeFocused();
  await expect(block.locator('.scb-run-stdout')).toHaveText(/Hello world!$/, { timeout: 5_000 });
});

test('without JavaScript, the Run button is hidden', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('./features/run-code/');
  const block = example(page, JS);
  await expect(block.locator('.scb-run')).toBeHidden();
  await expect(block.locator('.scb-run-controls')).toBeHidden();
  await expect(block.locator('.header')).toBeHidden();
  await context.close();
});
