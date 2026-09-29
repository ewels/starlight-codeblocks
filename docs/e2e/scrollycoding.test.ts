import { expect, type Page, test } from '@playwright/test';
import { phone, reduced } from './helpers.ts';

const scrolly = (page: Page, n = 0) => page.locator('.scb-scrolly').nth(n);
const sticky = (page: Page, n = 0) => scrolly(page, n).locator('.scb-scrolly-code');
const steps = (page: Page, n = 0) => scrolly(page, n).locator('.scb-scrolly-step');
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

test('shows the steps next to one sticky block, or a focused copy per step on a phone', async ({ page }) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  // Each step copy shows the version of its step.
  await expect(steps(page, 2).nth(1).locator('.expressive-code .ec-line')).toHaveCount(3);
  await expect(steps(page, 2).nth(2).locator('.expressive-code .ec-line')).toHaveCount(4);
  if (phone()) {
    await expect(sticky(page)).toBeHidden();
    const copy = steps(page).nth(3).locator('.expressive-code');
    await expect(copy).toBeVisible();
    await expect(copy.locator('.ec-line').nth(6)).not.toHaveClass(/scb-focus-out/);
    await expect(copy.locator('.ec-line').nth(0)).toHaveClass(/scb-focus-out/);
    return;
  }
  await expect(sticky(page)).toBeVisible();
  await expect(steps(page).locator('.expressive-code').first()).toBeHidden();
  const [a, b] = await Promise.all([steps(page).first().boundingBox(), sticky(page).boundingBox()]);
  expect(b?.x).toBeGreaterThan((a?.x ?? 0) + (a?.width ?? 0));
  // codeSide="left" puts the block in the left column.
  const [code, step] = await Promise.all([sticky(page, 3).boundingBox(), steps(page, 3).first().boundingBox()]);
  expect((code?.x ?? 0) + (code?.width ?? 0)).toBeLessThanOrEqual(step?.x ?? 0);
});

test.describe('wide layout', () => {
  test.skip(phone, 'The two columns need 600 px.');

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

  test('the step on the middle of the block sets the focus and marks, even after a jump', async ({ page }) => {
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

    const last = (await steps(page).count()) - 1;
    await centre(page, 0, last);
    await expect(steps(page).nth(last)).toHaveClass(/scb-scrolly-on/);
    // The block does not stay stuck alone after the last step.
    const { spare, half } = await scrolly(page).evaluate((root) => {
      const grid = root.querySelector('.scb-scrolly-steps')?.getBoundingClientRect();
      const code = root.querySelector('.scb-scrolly-code')?.getBoundingClientRect();
      const step = [...root.querySelectorAll('.scb-scrolly-step')].at(-1)?.getBoundingClientRect();
      return { spare: (grid?.bottom ?? 0) - (code?.bottom ?? 0), half: (step?.height ?? 0) / 2 };
    });
    expect(spare).toBeGreaterThanOrEqual(-1);
    expect(spare).toBeLessThanOrEqual(half);
    // A jump past several steps, such as the End key, still picks the right step.
    await centre(page, 0, 0);
    await expect(steps(page).nth(0)).toHaveClass(/scb-scrolly-on/);
    await page.keyboard.press('End');
    await expect(steps(page).nth(last)).toHaveClass(/scb-scrolly-on/);
    await page.keyboard.press('Home');
    await expect(steps(page).nth(0)).toHaveClass(/scb-scrolly-on/);

    await centre(page, 1, 1);
    await expect(sticky(page, 1).locator('.ec-line').nth(2)).toHaveClass(/mark/);
    await centre(page, 1, 0);
    await expect(sticky(page, 1).locator('.ec-line.mark')).toHaveCount(0);
  });

  test('the block stays blurred under the pointer, clears with keyboard focus, and fades at once under reduced motion', async ({
    page,
  }) => {
    const out = sticky(page).locator('.ec-line.scb-focus-out').first();
    await sticky(page).hover();
    await expect(out).not.toHaveCSS('filter', 'none');
    await sticky(page).locator('code').focus();
    await expect(out).toHaveCSS('filter', 'none');
    if (reduced()) {
      await expect(steps(page).first()).toHaveCSS('transition-duration', '0s');
      await expect(sticky(page).locator('.ec-line').nth(1)).toHaveCSS('transition-duration', '0s');
    }
  });
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

test('after a view transition, the old steps are no longer measured', async ({ page }) => {
  const stale = await page.evaluate(async () => {
    const html = await (await fetch(location.href)).text();
    let calls = 0;
    for (const step of document.querySelectorAll<HTMLElement>('.scb-scrolly-step')) {
      step.getBoundingClientRect = () => {
        calls++;
        return new DOMRect();
      };
    }
    document.body.replaceWith(new DOMParser().parseFromString(html, 'text/html').body);
    document.dispatchEvent(new Event('astro:page-load'));
    for (const y of [400, 800]) {
      window.scrollTo({ top: y, behavior: 'instant' });
      dispatchEvent(new Event('resize'));
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    }
    return calls;
  });
  expect(stale).toBe(0);
  await expect(scrolly(page).locator('.scb-scrolly-on')).toHaveCount(1);
});

test.describe('versions of the code', () => {
  const lines = (page: Page) => sticky(page, 2).locator('.scb-scrolly-current .ec-line');
  const sharp = (page: Page) =>
    lines(page).evaluateAll((all) => all.flatMap((l, i) => (l.classList.contains('scb-focus-out') ? [] : [i + 1])));

  test('a step after a new version animates the sticky block to it and back, and keyboard focus follows', async ({
    page,
  }) => {
    test.skip(phone(), 'The two columns need 600 px.');
    await expect(lines(page)).toHaveCount(3);
    await centre(page, 2, 2);
    await expect(steps(page, 2).nth(2)).toHaveClass(/scb-scrolly-on/);
    await expect(lines(page)).toHaveCount(4);
    if (!reduced()) {
      await expect(sticky(page, 2).locator('.scb-steps-anim')).toBeAttached();
    }
    await expect(sticky(page, 2).locator('.scb-steps-anim')).toHaveCount(0);
    await expect.poll(() => sharp(page)).toEqual([2]);
    await centre(page, 2, 1);
    await expect(lines(page)).toHaveCount(3);
    await expect.poll(() => sharp(page)).toEqual([3]);
    // Keyboard focus in the sticky block moves to the new version.
    await expect(sticky(page, 2).locator('.scb-steps-anim')).toHaveCount(0);
    await sticky(page, 2).locator('.scb-scrolly-current pre > code').focus();
    await centre(page, 2, 2);
    await expect(steps(page, 2).nth(2)).toHaveClass(/scb-scrolly-on/);
    await expect(sticky(page, 2).locator('.scb-scrolly-current pre > code')).toBeFocused();
    await expect(lines(page)).toHaveCount(4);
    await expect(sticky(page, 2).locator('.scb-scrolly-current .ec-line.scb-focus-out').first()).toHaveCSS(
      'opacity',
      '1',
    );
  });
});

test('the active step stays still at every scroll position near a new version', async ({ page }) => {
  test.skip(phone(), 'The two columns need 600 px.');
  test.setTimeout(60_000);
  // From the last step of the first version to the first step of the second.
  await centre(page, 2, 1);
  const from = await page.evaluate(() => scrollY);
  await centre(page, 2, 2);
  const to = await page.evaluate(() => scrollY);
  const moving = await scrolly(page, 2).evaluate(
    async (root, [from, to]) => {
      let changes = 0;
      new MutationObserver(() => changes++).observe(root, { subtree: true, attributeFilter: ['class'] });
      const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));
      const found: number[] = [];
      for (let y = from - 40; y <= to + 40; y += 4) {
        window.scrollTo({ top: y, behavior: 'instant' });
        await wait(80);
        changes = 0;
        await wait(250);
        if (changes > 3) found.push(y);
      }
      return found;
    },
    [from, to],
  );
  expect(moving, 'scroll positions where the block changes with no scroll').toEqual([]);
});

test.describe('on a page without a table of contents', () => {
  test.skip(phone, 'Phones have no space beside the content column.');
  const measure = async (page: Page) => ({
    column: await page.locator('.sl-markdown-content').boundingBox(),
    grid: await scrolly(page).locator('.scb-scrolly-grid').boundingBox(),
    code: await sticky(page).isVisible(),
    overflow: await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
  });

  test('a block with long lines spreads evenly, and keeps to the content column when the window is too narrow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('./features/scrollycoding/wide/');
    const wide = await measure(page);
    expect(wide.code).toBe(true);
    expect(wide.grid?.width).toBeCloseTo(1000, 0);
    const left = (wide.column?.x ?? 0) - (wide.grid?.x ?? 0);
    const right = (wide.grid?.x ?? 0) + (wide.grid?.width ?? 0) - (wide.column?.x ?? 0) - (wide.column?.width ?? 0);
    expect(Math.abs(left - right)).toBeLessThan(1);
    expect(wide.overflow).toBe(0);

    await page.setViewportSize({ width: 1100, height: 900 });
    await page.goto('./features/scrollycoding/wide/');
    const narrow = await measure(page);
    expect(narrow.code).toBe(false);
    expect(narrow.grid?.width).toBeCloseTo(narrow.column?.width ?? 0, 0);
    expect(narrow.overflow).toBe(0);
  });
});
