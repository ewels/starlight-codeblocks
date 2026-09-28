import { expect, type Page, test } from '@playwright/test';

const scrolly = (page: Page, n = 0) => page.locator('.scb-scrolly').nth(n);
const sticky = (page: Page, n = 0) => scrolly(page, n).locator('.scb-scrolly-code');
const steps = (page: Page, n = 0) => scrolly(page, n).locator('.scb-scrolly-step');
const phone = () => test.info().project.name.startsWith('phone');
const clear = (page: Page, n = 0) =>
  sticky(page, n)
    .locator('.ec-line')
    .evaluateAll((lines) => lines.flatMap((l, i) => (l.classList.contains('scb-focus-out') ? [] : [i + 1])));

/** Scrolls so that the middle of the step is on the line where steps become active. */
async function centre(page: Page, n: number, k: number) {
  await steps(page, n)
    .nth(k)
    .evaluate((e) => {
      const r = e.getBoundingClientRect();
      const root = e.closest<HTMLElement>('.scb-scrolly');
      const line = Number.parseFloat(root?.style.getPropertyValue('--scb-scrolly-line') ?? '') || innerHeight / 2;
      window.scrollTo({ top: scrollY + r.top + r.height / 2 - line, behavior: 'instant' });
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

  test('the active step stays level with the sticky block, from the first step to the last', async ({ page }) => {
    for (const [width, height] of [
      [1280, 720],
      [1440, 900],
      [1920, 1200],
    ]) {
      await page.setViewportSize({ width, height });
      const seen = new Set<number>();
      const top = await scrolly(page).evaluate((e) => e.getBoundingClientRect().top + scrollY);
      for (let y = top; y < top + 3000; y += 30) {
        await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y);
        await page.waitForTimeout(30);
        const r = await scrolly(page).evaluate((root) => {
          const code = root.querySelector('.scb-scrolly-code')?.getBoundingClientRect();
          const on = root.querySelector('.scb-scrolly-on');
          const text = on?.querySelector('.scb-scrolly-text')?.getBoundingClientRect();
          const k = [...root.querySelectorAll('.scb-scrolly-step')].indexOf(on as Element);
          const step = on?.getBoundingClientRect();
          return { k, code, text, past: !!code && !!step && step.bottom < (code.top + code.bottom) / 2 };
        });
        if (!r.code || !r.text) break;
        // The last step stays active after it has scrolled past.
        if (r.past) continue;
        seen.add(r.k);
        expect(r.text.top, `step ${r.k + 1} at ${width}×${height}`).toBeGreaterThanOrEqual(r.code.top);
        expect(r.text.bottom, `step ${r.k + 1} at ${width}×${height}`).toBeLessThanOrEqual(r.code.bottom);
      }
      expect(seen).toEqual(new Set([0, 1, 2, 3, 4]));
    }
  });

  test('the step on the middle of the block sets the focus', async ({ page }) => {
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
