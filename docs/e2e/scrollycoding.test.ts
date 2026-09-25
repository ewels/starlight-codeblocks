import { expect, type Page, test } from '@playwright/test';

const scrolly = (page: Page, n = 0) => page.locator('.scb-scrolly').nth(n);
const sticky = (page: Page, n = 0) => scrolly(page, n).locator('.scb-scrolly-code');
const steps = (page: Page, n = 0) => scrolly(page, n).locator('.scb-scrolly-step');
const phone = () => test.info().project.name.startsWith('phone');
const clear = (page: Page, n = 0) =>
  sticky(page, n)
    .locator('.ec-line')
    .evaluateAll((lines) => lines.flatMap((l, i) => (l.classList.contains('scb-focus-out') ? [] : [i + 1])));

/** Scrolls so that the middle of the step is in the middle of the window. */
async function centre(page: Page, n: number, k: number) {
  await steps(page, n)
    .nth(k)
    .evaluate((e) => {
      const r = e.getBoundingClientRect();
      window.scrollTo({ top: scrollY + r.top + r.height / 2 - innerHeight / 2, behavior: 'instant' });
    });
}

test.beforeEach(async ({ page }) => {
  await page.goto('./features/scrollycoding/');
});

test('the page does not scroll sideways', async ({ page }) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test.describe('wide layout', () => {
  test.skip(phone, 'The two columns need 600 px.');

  test('shows the steps next to one sticky block', async ({ page }) => {
    await expect(sticky(page)).toBeVisible();
    await expect(steps(page).locator('.expressive-code').first()).toBeHidden();
    const [a, b] = await Promise.all([steps(page).first().boundingBox(), sticky(page).boundingBox()]);
    expect(b?.x).toBeGreaterThan((a?.x ?? 0) + (a?.width ?? 0));
  });

  test('the step in the middle of the window sets the focus', async ({ page }) => {
    expect(await clear(page)).toEqual([1]);
    await centre(page, 0, 3);
    await expect(steps(page).nth(3)).toHaveClass(/scb-scrolly-on/);
    await expect.poll(() => clear(page)).toEqual([6, 7, 8]);
    await expect(steps(page).nth(3)).toHaveCSS('opacity', '1');
    await expect(steps(page).nth(0)).toHaveCSS('opacity', '0.38');
    const top = await sticky(page).evaluate((e) => e.getBoundingClientRect().top);
    const nav = await page.evaluate(
      () => Number.parseFloat(getComputedStyle(document.body).getPropertyValue('--sl-nav-height')) * 16,
    );
    expect(top).toBeGreaterThanOrEqual(nav);
    expect(top).toBeLessThan(nav + 40);
    await centre(page, 0, 1);
    await expect.poll(() => clear(page)).toEqual([3]);
  });

  test('a step can mark lines', async ({ page }) => {
    await centre(page, 1, 1);
    await expect(sticky(page, 1).locator('.ec-line').nth(2)).toHaveClass(/mark/);
    await centre(page, 1, 0);
    await expect(sticky(page, 1).locator('.ec-line.mark')).toHaveCount(0);
  });

  test('the block stays blurred under the pointer, and clears with keyboard focus', async ({ page }) => {
    const out = sticky(page).locator('.ec-line.scb-focus-out').first();
    await sticky(page).hover();
    await expect(out).not.toHaveCSS('filter', 'none');
    await sticky(page).locator('code').focus();
    await expect(out).toHaveCSS('filter', 'none');
  });

  test('under reduced motion, the steps fade with no transition', async ({ page }) => {
    test.skip(test.info().project.name !== 'reduced-motion');
    await expect(steps(page).first()).toHaveCSS('transition-duration', '0s');
    await expect(sticky(page).locator('.ec-line').nth(1)).toHaveCSS('transition-duration', '0s');
  });
});

test('on a phone, each step has its own focused copy of the block', async ({ page }) => {
  test.skip(!phone());
  await expect(sticky(page)).toBeHidden();
  const copy = steps(page).nth(3).locator('.expressive-code');
  await expect(copy).toBeVisible();
  const lines = copy.locator('.ec-line');
  await expect(lines.nth(6)).not.toHaveClass(/scb-focus-out/);
  await expect(lines.nth(0)).toHaveClass(/scb-focus-out/);
});

test('without JavaScript, the page shows the narrow layout', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('./features/scrollycoding/');
  await expect(sticky(page)).toBeHidden();
  await expect(steps(page).locator('.expressive-code')).toHaveCount(5);
  for (const copy of await steps(page).locator('.expressive-code').all()) await expect(copy).toBeVisible();
  await context.close();
});
