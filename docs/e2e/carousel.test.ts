import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { css, phone, reduced } from './helpers.ts';

const current = (page: Page) => page.locator('.carousel .slide[data-current]');
const tile = (page: Page, name: string) =>
  page.locator('.carousel .tile', { hasText: new RegExp(`^\\s*${name}\\s*$`) });
const dot = (page: Page, name: string) =>
  page.locator('.carousel').getByRole('button', { name: new RegExp(`^Show slide \\d+: ${name}$`) });
const shows = (page: Page, feature: string) =>
  expect(current(page)).toHaveAttribute('data-feature', `features/${feature}`);
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

async function load(page: Page) {
  await page.goto('./');
  await expect(page.locator('.carousel[data-ready]')).toBeAttached();
}

test.describe('rotation', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(reduced(), 'Rotation is off under reduced motion.');
    await page.clock.install();
    await load(page);
  });

  test('advances on its own, with the dot and its fill, without an announcement or a scroll', async ({ page }) => {
    const fill = () => page.locator('.carousel .dot[aria-current="true"] .fill');
    await shows(page, 'annotations');
    await expect(dot(page, 'Annotations')).toHaveAttribute('aria-current', 'true');
    await expect(fill()).toHaveCSS('transition-duration', '7s');
    expect(await fill().evaluate((el) => (el as HTMLElement).style.width)).toBe('100%');
    await scrollToFraction(page, 0.2, 'bottom');
    const scrollY = await page.evaluate(() => window.scrollY);
    await page.clock.runFor(interval);
    await shows(page, 'side-annotations');
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
    await expect(tile(page, 'Side annotations')).toHaveAttribute('aria-pressed', 'true');
    await expect(dot(page, 'Annotations')).toHaveAttribute('aria-current', 'false');
    await expect(dot(page, 'Side annotations')).toHaveAttribute('aria-current', 'true');
    // The next dot's fill starts a fresh 7s transition from 0.
    await expect(fill()).toHaveCSS('transition-duration', '7s');
    expect(await fill().evaluate((el) => (el as HTMLElement).style.width)).toBe('100%');
    await expect(page.locator('.carousel [data-status]')).toHaveText('');
  });

  test('the pause control stops and starts the rotation', async ({ page }) => {
    const rotation = page.locator('.carousel .rotation');
    const press = async () => {
      if (phone()) await rotation.tap();
      else await rotation.click();
      await page.mouse.move(0, 0);
    };
    await expect(rotation).toHaveAccessibleName('Pause');
    await press();
    await expect(rotation).toHaveAccessibleName('Play');
    await page.clock.runFor(interval * 2);
    await shows(page, 'annotations');
    await press();
    await expect(rotation).toHaveAccessibleName('Pause');
    await page.clock.runFor(interval);
    await shows(page, 'side-annotations');
  });

  test('pauses while the pointer is over the carousel or focus is in it', async ({ page }) => {
    await current(page).locator('.expressive-code').hover();
    await page.clock.runFor(interval * 2);
    await shows(page, 'annotations');
    await page.mouse.move(0, 0);
    await page.clock.runFor(interval);
    await shows(page, 'side-annotations');
    await tile(page, 'Focus').focus();
    await page.clock.runFor(interval * 2);
    await shows(page, 'side-annotations');
    await page.locator('h1').click();
    await page.mouse.move(0, 0);
    await page.clock.runFor(interval);
    await shows(page, 'footnotes');
  });

  test('selecting a feature stops the rotation, and so does using an example', async ({ page }) => {
    await tile(page, 'Annotations').click();
    await page.locator('h1').click();
    await page.mouse.move(0, 0);
    await page.clock.runFor(interval * 2);
    await shows(page, 'annotations');
    await expect(page.locator('.carousel .rotation')).toHaveAccessibleName('Play');
    await page.locator('.carousel .rotation').click();
    const marker = current(page).locator('button[popovertarget]').first();
    await marker.click();
    await expect(page.locator(`[id="${await marker.getAttribute('popovertarget')}"]`)).toBeVisible();
    await page.clock.runFor(interval * 2);
    await shows(page, 'annotations');
  });
});

test('a button or a dot shows its example, announces it and marks itself, and the docs link stays put', async ({
  page,
}) => {
  await page.goto('./');
  const docsLink = (name: string) => page.getByRole('link', { name: `Read docs : ${name}` });
  // Both rects in one frame: clicking a tile starts a smooth scroll.
  const offsetFromCard = (name: string) =>
    docsLink(name).evaluate((el) => {
      const link = el.getBoundingClientRect();
      const card = (el.closest('.card') as HTMLElement).getBoundingClientRect();
      return { top: Math.round(link.top - card.top), right: Math.round(card.right - link.right) };
    });
  const first = await docsLink('Annotations').boundingBox();
  expect(first?.width).toBeGreaterThanOrEqual(24);
  expect(first?.height).toBeGreaterThanOrEqual(24);
  const firstOffset = await offsetFromCard('Annotations');
  // Checked before any mouse click: a pointer interaction puts Chromium into mouse input modality,
  // where a later programmatic .focus() no longer matches :focus-visible.
  await docsLink('Annotations').focus();
  expect(await css(docsLink('Annotations'), 'outlineStyle')).not.toBe('none');

  await tile(page, 'Word-level diff').click();
  const slide = current(page);
  await shows(page, 'word-level-diff');
  await expect(slide.locator('.ec-line').first()).toBeVisible();
  await expect(docsLink('Word-level diff')).toHaveAttribute('href', '/starlight-codeblocks/features/word-level-diff/');
  expect(await offsetFromCard('Word-level diff')).toEqual(firstOffset);
  await expect(page.locator('.carousel .slide:not([data-current])').first()).toBeHidden();
  await expect(page.locator('.carousel .tile[aria-pressed="true"]')).toHaveCount(1);
  await expect(tile(page, 'Word-level diff')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.carousel [data-status]')).toHaveText('Word-level diff, 15 of 23');
  // The current button differs by more than colour.
  expect(await css(tile(page, 'Word-level diff'), 'fontWeight')).toBe('600');
  expect(await css(tile(page, 'Footnotes'), 'fontWeight')).toBe('400');

  await dot(page, 'Focus').click();
  await shows(page, 'focus');
  await expect(dot(page, 'Focus')).toHaveAttribute('aria-current', 'true');
  await expect(dot(page, 'Word-level diff')).toHaveAttribute('aria-current', 'false');
  await expect(tile(page, 'Focus')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.carousel [data-status]')).toHaveText(/^Focus, \d+ of 23$/);
  await expect(page.locator('.carousel .rotation')).toHaveAccessibleName('Play');
});

test('the buttons are a flat list in sidebar order, in even columns, with one dot each', async ({ page }) => {
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

  const boxes = await tiles.evaluateAll((els) =>
    els.map((el) => el.getBoundingClientRect()).map((r) => [Math.round(r.x), Math.round(r.y)]),
  );
  const columns = [...new Set(boxes.map(([x]) => x))].map((x) => boxes.filter(([bx]) => bx === x).map(([, y]) => y));
  const lengths = columns.map((c) => c.length);
  expect(Math.max(...lengths) - Math.min(...lengths)).toBeLessThanOrEqual(1);
  // Each column holds the next run of tiles in order, so the x of the tiles never goes back.
  expect(boxes.every(([x], i) => i === 0 || x >= (boxes[i - 1]?.[0] ?? 0))).toBe(true);
  for (const column of columns) expect(column).toEqual((columns[0] ?? []).slice(0, column.length));
  // The phone viewport (360px) is too narrow for the auto column width, so it's forced to two.
  if (phone()) expect(lengths).toEqual([12, 11]);

  await expect(page.locator('.carousel .dot')).toHaveCount(23);
  const order = await page.locator('.carousel .controls > *').evaluateAll((els) => els.map((el) => el.className));
  expect(order.at(-1)).toContain('rotation');
});

test('works with the keyboard, and the dots use a roving tabindex and arrow keys', async ({ page }) => {
  await page.goto('./');
  const button = tile(page, 'Hidden lines');
  await button.focus();
  await page.keyboard.press('Enter');
  await shows(page, 'hidden-lines');
  expect(await css(button, 'outlineStyle')).not.toBe('none');
  await tile(page, 'Focus').focus();
  await page.keyboard.press('Space');
  await shows(page, 'focus');
  const rotation = page.locator('.carousel .rotation');
  await rotation.focus();
  await page.keyboard.press('Enter');
  await expect(rotation).toHaveAccessibleName(/Pause|Play/);

  await dot(page, 'Annotations').focus();
  await expect(dot(page, 'Focus')).toHaveAttribute('tabindex', '0');
  await expect(dot(page, 'Annotations')).toHaveAttribute('tabindex', '-1');
  await page.keyboard.press('Home');
  await shows(page, 'annotations');
  await expect(dot(page, 'Annotations')).toHaveAttribute('tabindex', '0');
  await page.keyboard.press('ArrowRight');
  await shows(page, 'side-annotations');
  await expect(dot(page, 'Side annotations')).toBeFocused();
  await expect(dot(page, 'Side annotations')).toHaveAttribute('tabindex', '0');
  await expect(dot(page, 'Annotations')).toHaveAttribute('tabindex', '-1');
  expect(await css(dot(page, 'Side annotations'), 'outlineStyle')).not.toBe('none');
  await page.keyboard.press('ArrowLeft');
  await shows(page, 'annotations');
  await page.keyboard.press('End');
  await shows(page, 'run-in-the-browser');
  await expect(dot(page, 'Run in the browser')).toBeFocused();
});

test('does not rotate or animate under reduced motion', async ({ page }) => {
  test.skip(!reduced(), 'Only for the reduced-motion project.');
  await page.clock.install();
  await page.goto('./');
  await expect(page.locator('.carousel .rotation')).toHaveAccessibleName('Play');
  await page.clock.runFor(interval * 3);
  await shows(page, 'annotations');
  await expect(page.locator('.carousel .dot[aria-current="true"] .fill')).toHaveCSS('width', '0px');
  await tile(page, 'Focus').click();
  expect(await css(current(page), 'transitionDuration')).toBe('0s');
});

test('fits a phone screen', async ({ page }) => {
  test.skip(!phone(), 'Only for phones.');
  await page.goto('./');
  await expect(page.locator('.carousel .dots')).toBeVisible();
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(await overflow()).toBeLessThanOrEqual(0);
  for (const name of ['Side annotations', 'Scrollycoding', 'Code switcher']) {
    await tile(page, name).click();
    expect(await overflow()).toBeLessThanOrEqual(0);
  }
});

test('has no accessibility violations apart from the fade', async ({ page }) => {
  await load(page);
  // Expressive Code makes a block that scrolls focusable after the page loads.
  await page.waitForFunction(() =>
    [...document.querySelectorAll('pre')].every((pre) => pre.scrollWidth <= pre.clientWidth || pre.tabIndex === 0),
  );
  // Expressive Code gives each block the same landmark name, which is an upstream issue.
  const { violations } = await new AxeBuilder({ page }).include('main').disableRules(['landmark-unique']).analyze();
  const contrast = violations.find((v) => v.id === 'color-contrast');
  const other = violations.filter((v) => v.id !== 'color-contrast');
  expect(other.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
  // Axe reports the token, so the class of a dimmed line shows in the selector, not in the token's HTML.
  for (const node of contrast?.nodes ?? []) expect(`${node.target} ${node.html}`).toMatch(/scb-focus-out|scb-mention/);
});

test('scrolls the chosen example into view only as far as it needs to', async ({ page }) => {
  const clickFocus = () => tile(page, 'Focus').evaluate((el) => (el as HTMLElement).click());

  await load(page);
  await scrollToFraction(page, 0.65, 'bottom');
  const before = await page.evaluate(() => window.scrollY);
  await clickFocus();
  expect(await page.evaluate(() => window.scrollY)).toBe(before);

  await load(page);
  await scrollToFraction(page, 0.2, 'bottom');
  const [header, viewportHeight] = await Promise.all([headerHeight(page), page.evaluate(() => window.innerHeight)]);
  // Read in the same task as the click: under reduced motion the scroll must be instant.
  const bottom = await page.evaluate(() => {
    (document.querySelector('.carousel .tile[data-feature="features/focus"]') as HTMLElement).click();
    return Math.round((document.querySelector('.carousel .card') as HTMLElement).getBoundingClientRect().bottom);
  });
  if (reduced()) expect(bottom).toBe(Math.round(viewportHeight));
  await expect.poll(() => cardEdge(page, 'bottom')).toBe(Math.round(viewportHeight));
  expect(await cardEdge(page, 'top')).toBeGreaterThanOrEqual(Math.round(header) - 1);

  await load(page);
  await scrollToFraction(page, 0.2, 'top');
  await clickFocus();
  await expect.poll(() => cardEdge(page, 'top')).toBe(Math.round(header));

  if (phone()) {
    // Only phones make this example taller than the screen.
    await load(page);
    await tile(page, 'Side annotations').evaluate((el) => (el as HTMLElement).click());
    await expect.poll(() => cardEdge(page, 'top')).toBe(Math.round(header));
  }
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('shows the first example and links each button to its page', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('.carousel .slide').first()).toBeVisible();
    await expect(page.locator('.carousel .slide').nth(1)).toBeHidden();
    await expect(page.locator('.carousel .rotation')).toBeHidden();
    await expect(page.locator('.carousel .dots')).toBeHidden();
    await expect(page.locator('.carousel a.tile', { hasText: 'Focus' })).toHaveAttribute(
      'href',
      '/starlight-codeblocks/features/focus/',
    );
    await expect(page.locator('.carousel a.tile')).toHaveCount(23);
    const docsLink = page.getByRole('link', { name: 'Read docs : Annotations' });
    await expect(docsLink).toBeVisible();
    await expect(docsLink).toHaveAttribute('href', '/starlight-codeblocks/features/annotations/');
  });
});
