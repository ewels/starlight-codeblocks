import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

const current = (page: Page) => page.locator('.carousel .slide[data-current]');
const tile = (page: Page, name: string) =>
  page.locator('.carousel .tile', { hasText: new RegExp(`^\\s*${name}\\s*$`) });
const dot = (page: Page, name: string) =>
  page.locator('.carousel').getByRole('button', { name: new RegExp(`^Show slide \\d+: ${name}$`) });
const interval = 7000;

// Positions the page so the current card sits at a chosen visible fraction, cut off at the
// given edge, so a test can set up "already visible enough" or "needs to scroll" precisely.
const scrollToFraction = (page: Page, fraction: number, cut: 'top' | 'bottom') =>
  page.evaluate(
    ({ fraction, cut }) => {
      const header = document.querySelector('.header') as HTMLElement;
      const card = document.querySelector('.carousel .card') as HTMLElement;
      const headerHeight = header.getBoundingClientRect().height;
      const viewportHeight = window.innerHeight;
      const available = viewportHeight - headerHeight;
      const rect = card.getBoundingClientRect();
      const visible = fraction * Math.min(rect.height, available);
      const top = cut === 'bottom' ? viewportHeight - visible : headerHeight + visible - rect.height;
      window.scrollBy({ top: rect.top - top, behavior: 'auto' });
    },
    { fraction, cut },
  );

const headerHeight = (page: Page) =>
  page.evaluate(() => (document.querySelector('.header') as HTMLElement).getBoundingClientRect().height);
const cardEdge = (page: Page, edge: 'top' | 'bottom') =>
  page.evaluate(
    (edge) => Math.round((document.querySelector('.carousel .card') as HTMLElement).getBoundingClientRect()[edge]),
    edge,
  );

test.describe('rotation', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'reduced-motion', 'Rotation is off under reduced motion.');
    await page.clock.install();
    await page.goto('./');
    await expect(page.locator('.carousel[data-ready]')).toBeAttached();
  });

  test('advances on its own without an announcement', async ({ page }) => {
    await expect(current(page)).toHaveAttribute('data-feature', 'features/annotations');
    await page.clock.runFor(interval);
    await expect(current(page)).toHaveAttribute('data-feature', 'features/footnotes');
    await expect(tile(page, 'Footnotes')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.carousel [data-status]')).toHaveText('');
  });

  test('the current dot follows the rotation', async ({ page }) => {
    await expect(dot(page, 'Annotations')).toHaveAttribute('aria-current', 'true');
    await page.clock.runFor(interval);
    await expect(dot(page, 'Annotations')).toHaveAttribute('aria-current', 'false');
    await expect(dot(page, 'Footnotes')).toHaveAttribute('aria-current', 'true');
  });

  test('the current dot animates its fill towards the next slide', async ({ page }) => {
    const fill = () => page.locator('.carousel .dot[aria-current="true"] .fill');
    await expect(fill()).toHaveCSS('transition-duration', '7s');
    expect(await fill().evaluate((el) => (el as HTMLElement).style.width)).toBe('100%');
    await page.clock.runFor(interval);
    // The next dot is now current, and its fill starts a fresh 7s transition from 0.
    await expect(fill()).toHaveCSS('transition-duration', '7s');
    expect(await fill().evaluate((el) => (el as HTMLElement).style.width)).toBe('100%');
  });

  test('the pause control stops and starts the rotation', async ({ page }) => {
    const rotation = page.locator('.carousel .rotation');
    await expect(rotation).toHaveAccessibleName('Pause');
    await rotation.click();
    await page.mouse.move(0, 0);
    await expect(rotation).toHaveAccessibleName('Play');
    await page.clock.runFor(interval * 2);
    await expect(current(page)).toHaveAttribute('data-feature', 'features/annotations');
    await rotation.click();
    await page.mouse.move(0, 0);
    await page.clock.runFor(interval);
    await expect(current(page)).toHaveAttribute('data-feature', 'features/footnotes');
  });

  test('pauses while the pointer is over the carousel', async ({ page }) => {
    await page.locator('.carousel .slide[data-current] .expressive-code').hover();
    await page.clock.runFor(interval * 2);
    await expect(current(page)).toHaveAttribute('data-feature', 'features/annotations');
    await page.mouse.move(0, 0);
    await page.clock.runFor(interval);
    await expect(current(page)).toHaveAttribute('data-feature', 'features/footnotes');
  });

  test('pauses while focus is in the carousel', async ({ page }) => {
    await tile(page, 'Focus').focus();
    await page.clock.runFor(interval * 2);
    await expect(current(page)).toHaveAttribute('data-feature', 'features/annotations');
    await page.locator('h1').click();
    await page.mouse.move(0, 0);
    await page.clock.runFor(interval);
    await expect(current(page)).toHaveAttribute('data-feature', 'features/footnotes');
  });

  test('pauses while a reader uses an example', async ({ page }) => {
    await tile(page, 'Annotations').click();
    await page.locator('.carousel .rotation').click();
    const marker = page.locator('.carousel .slide[data-current] button[popovertarget]').first();
    await marker.click();
    await expect(page.locator(`[id="${await marker.getAttribute('popovertarget')}"]`)).toBeVisible();
    await page.clock.runFor(interval * 2);
    await expect(current(page)).toHaveAttribute('data-feature', 'features/annotations');
  });

  test('selecting a feature stops the rotation', async ({ page }) => {
    await tile(page, 'Focus').click();
    await page.locator('h1').click();
    await page.mouse.move(0, 0);
    await page.clock.runFor(interval * 2);
    await expect(current(page)).toHaveAttribute('data-feature', 'features/focus');
    await expect(page.locator('.carousel .rotation')).toHaveAccessibleName('Play');
  });
});

test('selecting a button shows its example and announces it', async ({ page }) => {
  await page.goto('./');
  await tile(page, 'Word-level diff').click();
  const slide = current(page);
  await expect(slide).toHaveAttribute('data-feature', 'features/word-level-diff');
  await expect(slide).toBeVisible();
  await expect(slide.locator('.ec-line').first()).toBeVisible();
  await expect(slide.getByRole('link', { name: 'Read docs : Word-level diff' })).toHaveAttribute(
    'href',
    '/starlight-codeblocks/features/word-level-diff/',
  );
  await expect(page.locator('.carousel .slide:not([data-current])').first()).toBeHidden();
  await expect(page.locator('.carousel .tile[aria-pressed="true"]')).toHaveCount(1);
  await expect(tile(page, 'Word-level diff')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.carousel [data-status]')).toHaveText('Word-level diff, 15 of 23');
});

const box = async (locator: ReturnType<Page['locator']>) => {
  const b = await locator.boundingBox();
  if (!b) throw new Error('Element has no bounding box');
  return b;
};

test('the docs link sits in the same top-right spot on every slide, with a 24px+ target and visible focus', async ({
  page,
}) => {
  await page.goto('./');
  const docsLink = (name: string) => page.getByRole('link', { name: `Read docs : ${name}` });
  // Position relative to the card, not the viewport: clicking a tile can scroll the page.
  const offsetFromCard = async (name: string) => {
    const card = await box(page.locator('.carousel .card'));
    const link = await box(docsLink(name));
    return { top: link.y - card.y, right: card.x + card.width - (link.x + link.width) };
  };

  const first = await box(docsLink('Annotations'));
  expect(first.width).toBeGreaterThanOrEqual(24);
  expect(first.height).toBeGreaterThanOrEqual(24);
  const firstOffset = await offsetFromCard('Annotations');

  // Checked before any mouse click switches slides: a prior pointer interaction puts Chromium into
  // mouse input modality, where a later programmatic .focus() no longer matches :focus-visible.
  await docsLink('Annotations').focus();
  expect(await docsLink('Annotations').evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');

  await tile(page, 'Word-level diff').click();
  const secondOffset = await offsetFromCard('Word-level diff');
  expect(Math.round(secondOffset.top)).toBe(Math.round(firstOffset.top));
  expect(Math.round(secondOffset.right)).toBe(Math.round(firstOffset.right));
});

test('the current button differs by more than colour', async ({ page }) => {
  await page.goto('./');
  await tile(page, 'Focus').click();
  const weight = (name: string) => tile(page, name).evaluate((el) => getComputedStyle(el).fontWeight);
  expect(await weight('Focus')).toBe('600');
  expect(await weight('Footnotes')).toBe('400');
});

test('the buttons are a flat list in sidebar order, with no group headings', async ({ page }) => {
  await page.goto('./getting-started/');
  const sidebarIds = await page
    .locator('nav[aria-label="Main"] a[href*="/features/"]')
    .evaluateAll((els) =>
      els.map((el) => new URL((el as HTMLAnchorElement).href).pathname.replace(/^\/starlight-codeblocks\/|\/$/g, '')),
    );
  await page.goto('./');
  await expect(page.locator('.carousel .group-label')).toHaveCount(0);
  const tiles = page.locator('.carousel .tile');
  await expect(tiles).toHaveCount(23);
  await expect(page.locator('.carousel .tile svg[aria-hidden], .carousel .tile [aria-hidden] svg')).toHaveCount(23);
  const tileIds = await tiles.evaluateAll((els) => els.map((el) => el.getAttribute('data-feature')));
  expect(tileIds).toEqual(sidebarIds.filter((id) => tileIds.includes(id)));
});

test('the buttons fill each column from top to bottom, in columns of even length with aligned rows', async ({
  page,
}, testInfo) => {
  await page.goto('./');
  const boxes = await page
    .locator('.carousel .tile')
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect()).map((r) => [Math.round(r.x), Math.round(r.y)]));
  const columns = [...new Set(boxes.map(([x]) => x))].map((x) => boxes.filter(([bx]) => bx === x).map(([, y]) => y));
  const lengths = columns.map((c) => c.length);
  expect(Math.max(...lengths) - Math.min(...lengths)).toBeLessThanOrEqual(1);
  // Each column holds the next run of tiles in order, so the x of the tiles never goes back.
  expect(boxes.every(([x], i) => i === 0 || x >= (boxes[i - 1]?.[0] ?? 0))).toBe(true);
  for (const column of columns) {
    expect(column).toEqual((columns[0] ?? []).slice(0, column.length));
  }
  // The phone viewport (360px) is too narrow for the auto column width, so it's forced to two.
  if (testInfo.project.name.startsWith('phone')) {
    expect(lengths).toEqual([12, 11]);
  }
});

test('has one dot per slide, before the pause control', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.carousel .dot')).toHaveCount(23);
  const order = await page.locator('.carousel .controls > *').evaluateAll((els) => els.map((el) => el.className));
  expect(order[order.length - 1]).toContain('rotation');
});

test('clicking a dot shows its slide, announces it and stops the rotation', async ({ page }) => {
  await page.goto('./');
  await dot(page, 'Word-level diff').click();
  await expect(current(page)).toHaveAttribute('data-feature', 'features/word-level-diff');
  await expect(dot(page, 'Word-level diff')).toHaveAttribute('aria-current', 'true');
  await expect(dot(page, 'Annotations')).toHaveAttribute('aria-current', 'false');
  await expect(tile(page, 'Word-level diff')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.carousel [data-status]')).toHaveText('Word-level diff, 15 of 23');
  await expect(page.locator('.carousel .rotation')).toHaveAccessibleName('Play');
});

test('works with the keyboard', async ({ page }) => {
  await page.goto('./');
  const button = tile(page, 'Hidden lines');
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(current(page)).toHaveAttribute('data-feature', 'features/hidden-lines');
  expect(await button.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
  await tile(page, 'Focus').focus();
  await page.keyboard.press('Space');
  await expect(current(page)).toHaveAttribute('data-feature', 'features/focus');
  const rotation = page.locator('.carousel .rotation');
  await rotation.focus();
  await page.keyboard.press('Enter');
  await expect(rotation).toHaveAccessibleName(/Pause|Play/);
});

test('the dots use a roving tabindex and arrow keys', async ({ page }) => {
  await page.goto('./');
  await dot(page, 'Annotations').focus();
  await expect(dot(page, 'Annotations')).toHaveAttribute('tabindex', '0');
  await expect(dot(page, 'Footnotes')).toHaveAttribute('tabindex', '-1');
  await page.keyboard.press('ArrowRight');
  await expect(current(page)).toHaveAttribute('data-feature', 'features/footnotes');
  await expect(dot(page, 'Footnotes')).toBeFocused();
  await expect(dot(page, 'Footnotes')).toHaveAttribute('tabindex', '0');
  await expect(dot(page, 'Annotations')).toHaveAttribute('tabindex', '-1');
  expect(await dot(page, 'Footnotes').evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
  await page.keyboard.press('ArrowLeft');
  await expect(current(page)).toHaveAttribute('data-feature', 'features/annotations');
  await page.keyboard.press('End');
  await expect(current(page)).toHaveAttribute('data-feature', 'features/run-in-the-browser');
  await expect(dot(page, 'Run in the browser')).toBeFocused();
  await page.keyboard.press('Home');
  await expect(current(page)).toHaveAttribute('data-feature', 'features/annotations');
});

test('does not rotate or animate under reduced motion', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'reduced-motion', 'Only for the reduced-motion project.');
  await page.clock.install();
  await page.goto('./');
  await expect(page.locator('.carousel .rotation')).toHaveAccessibleName('Play');
  await page.clock.runFor(interval * 3);
  await expect(current(page)).toHaveAttribute('data-feature', 'features/annotations');
  await expect(page.locator('.carousel .dot[aria-current="true"] .fill')).toHaveCSS('width', '0px');
  await tile(page, 'Focus').click();
  expect(await current(page).evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s');
});

test('fits a phone screen', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('phone'), 'Only for phones.');
  await page.goto('./');
  await expect(page.locator('.carousel .dots')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  for (const name of ['Side-by-side annotations', 'Scrollycoding', 'Code switcher']) {
    await tile(page, name).click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  }
});

test('has no accessibility violations apart from the fade', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.carousel[data-ready]')).toBeAttached();
  // Expressive Code makes a block that scrolls focusable after the page loads.
  await page.waitForFunction(() =>
    [...document.querySelectorAll('pre')].every((pre) => pre.scrollWidth <= pre.clientWidth || pre.tabIndex === 0),
  );
  // Expressive Code gives each block the same landmark name, which is an upstream issue.
  const { violations } = await new AxeBuilder({ page }).include('main').disableRules(['landmark-unique']).analyze();
  const contrast = violations.find((v) => v.id === 'color-contrast');
  const other = violations.filter((v) => v.id !== 'color-contrast');
  expect(other.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
  for (const node of contrast?.nodes ?? []) expect(node.html).toMatch(/scb-focus-out|scb-mention/);
});

test.describe('scrolling the chosen example into view', () => {
  test('does not scroll when the example is already at least half visible', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('.carousel[data-ready]')).toBeAttached();
    await scrollToFraction(page, 0.65, 'bottom');
    const before = await page.evaluate(() => window.scrollY);
    await tile(page, 'Focus').evaluate((el) => (el as HTMLElement).click());
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
  });

  test('scrolls down the minimum distance to bring a short example fully into view', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('.carousel[data-ready]')).toBeAttached();
    await scrollToFraction(page, 0.2, 'bottom');
    const [header, viewportHeight] = await Promise.all([headerHeight(page), page.evaluate(() => window.innerHeight)]);
    await tile(page, 'Focus').evaluate((el) => (el as HTMLElement).click());
    await expect.poll(() => cardEdge(page, 'bottom')).toBe(Math.round(viewportHeight));
    expect(await cardEdge(page, 'top')).toBeGreaterThanOrEqual(Math.round(header) - 1);
  });

  test('scrolls up the minimum distance to bring a short example fully into view', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('.carousel[data-ready]')).toBeAttached();
    await scrollToFraction(page, 0.2, 'top');
    const header = await headerHeight(page);
    await tile(page, 'Focus').evaluate((el) => (el as HTMLElement).click());
    await expect.poll(() => cardEdge(page, 'top')).toBe(Math.round(header));
  });

  test('aligns a tall example under the header on a phone screen', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('phone'), 'Only phones make this example taller than the screen.');
    await page.goto('./');
    await expect(page.locator('.carousel[data-ready]')).toBeAttached();
    const header = await headerHeight(page);
    await tile(page, 'Side-by-side annotations').evaluate((el) => (el as HTMLElement).click());
    await expect.poll(() => cardEdge(page, 'top')).toBe(Math.round(header));
  });

  test('scrolls instantly under reduced motion', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'reduced-motion', 'Only meaningful where scrolling would otherwise animate.');
    await page.goto('./');
    await expect(page.locator('.carousel[data-ready]')).toBeAttached();
    await scrollToFraction(page, 0.2, 'bottom');
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    const bottom = await page.evaluate(() => {
      (document.querySelector('.carousel .tile[data-feature="features/focus"]') as HTMLElement).click();
      return (document.querySelector('.carousel .card') as HTMLElement).getBoundingClientRect().bottom;
    });
    expect(Math.round(bottom)).toBe(Math.round(viewportHeight));
  });

  test('never scrolls on auto-rotation', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'reduced-motion', 'Rotation is off under reduced motion.');
    await page.clock.install();
    await page.goto('./');
    await expect(page.locator('.carousel[data-ready]')).toBeAttached();
    await scrollToFraction(page, 0.2, 'bottom');
    const before = await page.evaluate(() => window.scrollY);
    await page.clock.runFor(interval);
    await expect(current(page)).toHaveAttribute('data-feature', 'features/footnotes');
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('shows the first example and links each button to its page', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('.carousel .slide').first()).toBeVisible();
    await expect(page.locator('.carousel .slide').nth(1)).toBeHidden();
    await expect(page.locator('.carousel .rotation')).toBeHidden();
    await expect(page.locator('.carousel .dots')).toBeHidden();
    const link = page.locator('.carousel a.tile', { hasText: 'Focus' });
    await expect(link).toHaveAttribute('href', '/starlight-codeblocks/features/focus/');
    await expect(page.locator('.carousel a.tile')).toHaveCount(23);
    const docsLink = page.getByRole('link', { name: 'Read docs : Annotations' });
    await expect(docsLink).toBeVisible();
    await expect(docsLink).toHaveAttribute('href', '/starlight-codeblocks/features/annotations/');
  });
});
