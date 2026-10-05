import { expect, type Locator, test } from '@playwright/test';
import { css, example, reduced } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('./features/annotations/');
});

/** Opens note `n` with a click, and waits until the script has placed it and it has finished opening. */
async function open(block: Locator, n: number) {
  const marker = block.getByRole('button', { name: `Annotation ${n}` });
  const note = block.locator('.scb-annotation-popover').nth(n - 1);
  await marker.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await marker.click();
  await expect(note).toBeVisible();
  await expect(note).not.toHaveClass(/scb-annotation-wait/);
  await note.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  const rects = await note.evaluate((el) => {
    const rect = (e: Element) => e.getBoundingClientRect().toJSON() as DOMRect;
    const line = el.closest('.ec-line') as Element;
    let textRight = Number.NEGATIVE_INFINITY;
    const range = document.createRange();
    const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const end = node.textContent?.trimEnd().length ?? 0;
      if (!end || node.parentElement?.closest('.scb-annotation, .scb-float')) continue;
      range.setStart(node, 0);
      range.setEnd(node, end);
      textRight = Math.max(textRight, range.getBoundingClientRect().right);
    }
    return {
      box: rect(el),
      badge: rect(el.querySelector('.scb-annotation-badge') as Element),
      text: rect(el.querySelector('p') as Element),
      marker: rect(el.previousElementSibling as Element),
      pre: rect(el.closest('pre') as Element),
      textRight,
    };
  });
  return { note, ...rects };
}

const centre = (r: DOMRect) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

const at = async (marker: Locator) => {
  const box = await marker.boundingBox();
  return [(box?.x ?? 0) + (box?.width ?? 0) / 2, (box?.y ?? 0) + (box?.height ?? 0) / 2] as const;
};

test('a marker opens its note, and a selection outside closes it', async ({ page }) => {
  const block = example(page);
  const note = block.locator('.scb-annotation-popover').first();
  await expect(note).toBeHidden();
  await open(block, 1);
  await expect(note).toHaveText('1Uses the Ubuntu GitHub Actions runner.');
  if (reduced()) expect(await css(note, 'animationName')).toBe('none');
  await page.mouse.click(5, 5);
  await expect(note).toBeHidden();
  // Inline code in a note uses the code font, with round corners in a titled block.
  await block.getByRole('button', { name: 'Annotation 2' }).click();
  const style = await block
    .locator('.scb-annotation-popover code')
    .first()
    .evaluate((el) => {
      const s = getComputedStyle(el);
      return { font: s.fontFamily, top: s.borderTopLeftRadius, bottom: s.borderBottomRightRadius };
    });
  expect(style.font).not.toBe('monospace');
  expect(style.font).toContain('ui-monospace');
  expect([style.top, style.bottom]).toEqual(['3px', '3px']);
});

test.describe('hover', () => {
  test.skip(({ isMobile }) => isMobile, 'Phones have no hover.');

  test('hovering over a marker fades in its note, which stays while the pointer moves into it', async ({ page }) => {
    const block = example(page);
    const marker = block.getByRole('button', { name: 'Annotation 1' });
    const note = block.locator('.scb-annotation-popover').first();
    await marker.hover();
    await expect(note).toBeVisible();
    await expect(note).not.toHaveClass(/scb-annotation-wait/);
    const style = await note.evaluate((el) => ({
      transition: getComputedStyle(el).transitionProperty,
      clip: getComputedStyle(el).clipPath,
    }));
    expect(style.clip).toBe('none');
    if (!reduced()) expect(style.transition).toContain('opacity');
    await expect.poll(() => css(note, 'opacity')).toBe('1');
    // Whatever is on top of the marker, the note's badge or the marker itself, shows a hand.
    const cursor = await page.evaluate(
      ([x, y]) => getComputedStyle(document.elementFromPoint(x, y) as Element).cursor,
      await at(marker),
    );
    expect(cursor).toBe('pointer');
    await note.locator('p').hover();
    await page.waitForTimeout(400);
    await expect(note).toBeVisible();
    await page.mouse.move(0, 0);
    await expect(note).toBeHidden();
  });

  test('clicks keep notes open after the pointer leaves, and hover adds to them', async ({ page }) => {
    const block = example(page);
    const notes = block.locator('.scb-annotation-popover');
    const [one, two] = [1, 2].map((n) => block.getByRole('button', { name: `Annotation ${n}` })) as [Locator, Locator];
    const leave = async () => {
      await page.mouse.move(0, 0);
      await page.waitForTimeout(400);
    };
    // A real click at the marker lands on whatever is on top of it, here the hover note's badge.
    await one.hover();
    await expect(notes.first()).not.toHaveClass(/scb-annotation-wait/);
    await page.mouse.click(...(await at(one)));
    await leave();
    await expect(notes.first()).toBeVisible();
    await page.mouse.click(...(await at(one)));
    await expect(notes.first()).toBeHidden();

    await one.click();
    await two.hover();
    await expect(notes.nth(1)).toBeVisible();
    await expect(notes.first()).toBeVisible();
    await page.mouse.move(0, 0);
    await expect(notes.nth(1)).toBeHidden();
    await expect(notes.first()).toBeVisible();

    await page.mouse.click(...(await at(two)));
    await leave();
    await expect(notes.nth(0)).toBeVisible();
    await expect(notes.nth(1)).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(notes.nth(0)).toBeHidden();
    await expect(notes.nth(1)).toBeHidden();
  });
});

/** The note is 340px wide (less on a phone), centred under its marker, 12px inside the viewport, with the badge inside. */
function expectBelow(r: Awaited<ReturnType<typeof open>>, width: number) {
  expect(r.box.width).toBeCloseTo(Math.min(340, width - 24), 0);
  const centred = r.marker.x + r.marker.width / 2 - r.box.width / 2;
  expect(r.box.x).toBeCloseTo(Math.min(Math.max(12, centred), width - 12 - r.box.width), 0);
  expect(r.box.y - (r.marker.y + r.marker.height)).toBeCloseTo(8, 0);
  expect(r.badge.x).toBeGreaterThan(r.box.x);
  expect(r.badge.y).toBeGreaterThan(r.box.y);
  expect(r.text.x).toBeGreaterThanOrEqual(r.badge.x + r.badge.width);
}

test('the note opens out of its marker with room after the line, and under it otherwise', async ({
  page,
  isMobile,
}) => {
  // The box would cover the code or leave the block.
  const below = await open(example(page, 1), 1);
  await expect(below.note).not.toHaveClass(/scb-annotation-end/);
  expectBelow(below, page.viewportSize()?.width ?? 0);
  await page.keyboard.press('Escape');

  if (!isMobile) {
    const { box, badge, text, marker, pre, textRight, note } = await open(example(page), 1);
    await expect(note).toHaveClass(/scb-annotation-end/);
    expect(Math.abs(centre(badge).x - centre(marker).x)).toBeLessThanOrEqual(1);
    expect(Math.abs(centre(badge).y - centre(marker).y)).toBeLessThanOrEqual(1);
    expect(badge.width).toBeCloseTo(marker.width, 0);
    expect(text.x).toBeGreaterThanOrEqual(badge.x + badge.width);
    expect(box.x).toBeGreaterThanOrEqual(textRight);
    expect(box.x + box.width).toBeLessThanOrEqual(Math.min(pre.x + pre.width, (page.viewportSize()?.width ?? 0) - 12));
    expect(box.width).toBeLessThan(340);
    expect(await note.evaluate((el) => getComputedStyle(el.querySelector('p') as Element).whiteSpace)).toBe('normal');
    // The open note moves under its marker when the window gets narrow.
    await page.setViewportSize({ width: 360, height: 780 });
    await expect(note).not.toHaveClass(/scb-annotation-end/);
    await page.keyboard.press('Escape');
  }

  await page.setViewportSize({ width: 360, height: 780 });
  for (const n of [1, 2]) {
    const r = await open(example(page), n);
    await expect(r.note).not.toHaveClass(/scb-annotation-end/);
    expectBelow(r, 360);
    await page.keyboard.press('Escape');
  }
});

test('with the keyboard, several notes can stay open, the badge shows focus, and Escape closes them', async ({
  page,
}) => {
  const block = example(page);
  const notes = block.locator('.scb-annotation-popover');
  const first = block.getByRole('button', { name: 'Annotation 1' });
  const badge = notes.first().locator('.scb-annotation-badge');
  await first.focus();
  await page.keyboard.press('Enter');
  await expect(notes.nth(0)).toBeVisible();
  await expect(first).toBeFocused();
  await expect.poll(() => css(badge, 'outlineStyle')).toBe('solid');
  const second = block.getByRole('button', { name: 'Annotation 2' });
  await second.focus();
  await expect.poll(() => css(badge, 'outlineStyle')).toBe('none');
  await page.keyboard.press('Enter');
  await expect(notes.nth(1)).toBeVisible();
  await expect(notes.nth(0)).toBeVisible();
  await expect(notes.nth(1).locator('code')).toHaveText('uv');
  await page.keyboard.press('Escape');
  await expect(notes.nth(1)).toBeHidden();
  await expect(notes.nth(0)).toBeHidden();
  await expect(second).toBeFocused();
});

test('the marker fades to the hover colour on the timing of the hover note', async ({ page, isMobile }) => {
  const marker = example(page).locator('.scb-annotation').first();
  const timing = () =>
    marker.evaluate((el) => [getComputedStyle(el).transitionDuration, getComputedStyle(el).transitionDelay]);
  if (reduced()) {
    expect((await timing())[0]).toBe('0s');
    return;
  }
  expect(await timing()).toEqual(['0.16s, 0.16s', '0s, 0s']);
  test.skip(isMobile, 'Phones have no hover.');
  const rest = await css(marker, 'backgroundColor');
  await marker.hover();
  expect(await timing()).toEqual(['0.16s, 0.16s', '0.08s']);
  const expected = await marker.evaluate((el) => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--ec-codeblocksAnnotations-markerHoverBg)';
    el.after(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  });
  await expect.poll(() => css(marker, 'backgroundColor')).toBe(expected);
  expect(expected).not.toBe(rest);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('a marker still opens its note', async ({ page }) => {
    const block = example(page);
    await block.getByRole('button', { name: 'Annotation 1' }).click();
    await expect(block.locator('.scb-annotation-popover').first()).toBeVisible();
  });
});

test('prints the notes as a numbered list under the block, and a marker keeps its circle in forced colours', async ({
  page,
}) => {
  const block = example(page);
  const marker = block.getByRole('button', { name: 'Annotation 1' });
  await page.emulateMedia({ forcedColors: 'active' });
  expect(await css(marker, 'borderTopStyle')).toBe('solid');
  expect(await css(marker, 'borderTopWidth')).toBe('1px');
  await page.emulateMedia({ forcedColors: 'none' });
  await expect(block.locator('.scb-annotation-list')).toBeHidden();
  await page.emulateMedia({ media: 'print' });
  await expect(block.locator('.scb-annotation-list li')).toHaveText([
    'Uses the Ubuntu GitHub Actions runner.',
    'Installs uv and caches its downloads between runs.',
  ]);
  await expect(marker).toBeVisible();
  await expect(block.locator('.scb-annotation-popover').first()).toBeHidden();
});
