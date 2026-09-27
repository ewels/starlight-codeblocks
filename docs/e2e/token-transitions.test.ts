import { expect, type Page, test } from '@playwright/test';

const steps = (page: Page, n = 0) => page.locator('.example').nth(n).locator('[data-scb-steps]');
const current = (page: Page, n = 0) => steps(page, n).locator(':scope > .expressive-code:visible');
const reduced = () => test.info().project.name === 'reduced-motion';
const phone = () => test.info().project.name.startsWith('phone');

test.beforeEach(async ({ page }) => {
  await page.goto('./features/token-transitions/');
});

test('shows the first step, with the steps and the label in the title bar', async ({ page }) => {
  await expect(current(page)).toHaveCount(1);
  await expect(current(page).locator('.title')).toHaveText('server.js');
  await expect(current(page).getByRole('group', { name: 'Steps' }).getByRole('button')).toHaveCount(3);
  await expect(current(page).getByRole('button', { name: 'Step 1: Create the app' })).toHaveAttribute(
    'aria-current',
    'step',
  );
  await expect(current(page).getByRole('button', { name: 'Previous' })).toBeDisabled();
  if (phone()) await expect(current(page).locator('.scb-steps-label')).toBeHidden();
  else await expect(current(page).locator('.scb-steps-label')).toHaveText('Create the app');
});

test('Previous, Next and the step counter sit under the block, not in the title bar', async ({ page }) => {
  const header = current(page).locator('.header');
  await expect(header.getByRole('button', { name: 'Previous' })).toHaveCount(0);
  await expect(header.getByRole('button', { name: 'Next' })).toHaveCount(0);
  const controls = current(page).locator('.scb-steps-controls');
  await expect(controls.locator('.scb-steps-count')).toHaveText('Step 1 of 3');
  for (const nav of await controls.getByRole('button').all()) {
    const box = await nav.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(24);
    expect(box?.height).toBeGreaterThanOrEqual(24);
  }
});

test('Next and Previous change the step, keep focus and announce it', async ({ page }) => {
  await current(page).getByRole('button', { name: 'Next' }).click();
  await expect(current(page)).toContainText('app.use(express.json());');
  await expect(current(page).getByRole('button', { name: 'Next' })).toBeFocused();
  await expect(steps(page).locator(':scope > [aria-live]')).toHaveText('Step 2: Parse JSON bodies');
  await expect(current(page).locator('.scb-steps-count')).toHaveText('Step 2 of 3');
  await current(page).getByRole('button', { name: 'Next' }).click();
  await expect(current(page)).toContainText("app.get('/health'");
  await expect(current(page).getByRole('button', { name: 'Next' })).toBeDisabled();
  await expect(current(page).getByRole('button', { name: 'Step 3: Add a health route' })).toBeFocused();
  await expect(current(page).locator('.scb-steps-count')).toHaveText('Step 3 of 3');
  await current(page).getByRole('button', { name: 'Previous' }).click();
  await expect(current(page).getByRole('button', { name: 'Step 2: Parse JSON bodies' })).toHaveAttribute(
    'aria-current',
    'step',
  );
  await expect(current(page).locator('.scb-steps-count')).toHaveText('Step 2 of 3');
});

test('a numbered step goes to its step, and the arrow keys move between steps', async ({ page }) => {
  await current(page).getByRole('button', { name: 'Step 3: Add a health route' }).click();
  await expect(current(page)).toContainText("app.get('/health'");
  await page.keyboard.press('ArrowLeft');
  await expect(current(page).getByRole('button', { name: 'Step 2: Parse JSON bodies' })).toBeFocused();
  await expect(current(page)).not.toContainText("app.get('/health'");
  await page.keyboard.press('ArrowRight');
  await expect(current(page).getByRole('button', { name: 'Step 3: Add a health route' })).toBeFocused();
});

test('the keyboard reaches the steps with Tab', async ({ page }) => {
  await current(page).getByRole('button', { name: 'Step 1: Create the app' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(current(page)).toContainText('app.use(express.json());');
  await expect(current(page).locator('.scb-steps-anim')).toHaveCount(0);
  // Past the last dot and the copy button, to the controls under the block.
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(current(page).getByRole('button', { name: 'Previous' })).toBeFocused();
});

test('animates the tokens in the colours of the theme, or changes at once under reduced motion', async ({ page }) => {
  const final = await current(page)
    .locator('.ec-line span', { hasText: /^listen$/ })
    .evaluate((e) => getComputedStyle(e).color);
  await current(page).getByRole('button', { name: 'Next' }).click();
  const anim = current(page).locator('.scb-steps-anim');
  if (reduced()) {
    await expect(anim).toHaveCount(0);
    await expect(current(page).locator('code')).toBeVisible();
    return;
  }
  const token = anim.locator('.shiki-magic-move-item', { hasText: /^listen$/ });
  await expect(token).toHaveCSS('color', final);
  await expect(anim).toHaveCount(0);
  await expect(current(page).locator('code')).toBeVisible();
});

test('the copy button copies the current step', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await current(page).getByRole('button', { name: 'Next' }).click();
  await expect(current(page).locator('.scb-steps-anim')).toHaveCount(0);
  await current(page).locator('.copy button').click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    'const app = express();\napp.use(express.json());\n\napp.listen(3000);',
  );
});

test('the title bar fits the block, and the page does not scroll sideways', async ({ page }) => {
  const header = current(page).locator('.header');
  expect(await header.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('without JavaScript, every step shows as its own block, with its label', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('./features/token-transitions/');
  await expect(current(page)).toHaveCount(3);
  await expect(current(page).locator('.scb-steps-label')).toHaveText([
    'Create the app',
    'Parse JSON bodies',
    'Add a health route',
  ]);
  await expect(current(page).first().getByRole('group', { name: 'Steps' })).toBeHidden();
  await expect(current(page).first().locator('.scb-steps-controls')).toBeHidden();
  await context.close();
});

test('the current step differs from the others in forced colours', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  const dots = current(page).locator('.scb-steps-dot');
  const background = (i: number) => dots.nth(i).evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(await background(0)).not.toBe(await background(1));
});
