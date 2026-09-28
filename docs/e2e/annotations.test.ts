import { expect, type Locator, test } from '@playwright/test';
import { copyFromKeyboard, css, example, reduced } from './helpers.ts';

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

test('a marker opens its note, and a selection outside closes it', async ({ page }) => {
  const block = example(page);
  const note = block.locator('.scb-annotation-popover').first();
  await expect(note).toBeHidden();
  await open(block, 1);
  await expect(note).toHaveText('1One job per version, run in parallel.');
  await page.mouse.click(5, 5);
  await expect(note).toBeHidden();
});

test.describe('hover', () => {
  test.skip(({ isMobile }) => isMobile, 'Phones have no hover.');

  test('hovering over a marker shows its note, and moving away hides it', async ({ page }) => {
    const block = example(page);
    const marker = block.getByRole('button', { name: 'Annotation 1' });
    const note = block.locator('.scb-annotation-popover').first();
    await marker.hover();
    await expect(note).toBeVisible();
    await page.mouse.move(0, 0);
    await expect(note).toBeHidden();
  });

  test('the note fades in as one element, and the pointer stays a hand over the marker', async ({ page }) => {
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
    const box = await marker.boundingBox();
    const cursor = await page.evaluate(
      ([x, y]) => getComputedStyle(document.elementFromPoint(x, y) as Element).cursor,
      [(box?.x ?? 0) + (box?.width ?? 0) / 2, (box?.y ?? 0) + (box?.height ?? 0) / 2],
    );
    expect(cursor).toBe('pointer');
  });

  test('the pointer can move from the marker into the note, which stays', async ({ page }) => {
    const block = example(page);
    const note = block.locator('.scb-annotation-popover').first();
    await block.getByRole('button', { name: 'Annotation 1' }).hover();
    await expect(note).toBeVisible();
    await note.locator('p').hover();
    await page.waitForTimeout(400);
    await expect(note).toBeVisible();
  });

  test('a click on a shown note keeps it open after the pointer leaves', async ({ page }) => {
    const block = example(page);
    const marker = block.getByRole('button', { name: 'Annotation 1' });
    const note = block.locator('.scb-annotation-popover').first();
    await marker.hover();
    await expect(note).toBeVisible();
    await marker.click();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(400);
    await expect(note).toBeVisible();
    await marker.click();
    await expect(note).toBeHidden();
  });

  test('while a clicked note is open, hovering over another marker shows that note too', async ({ page }) => {
    const block = example(page);
    const notes = block.locator('.scb-annotation-popover');
    await block.getByRole('button', { name: 'Annotation 1' }).click();
    await expect(notes.first()).toBeVisible();
    await block.getByRole('button', { name: 'Annotation 2' }).hover();
    await expect(notes.nth(1)).toBeVisible();
    await expect(notes.first()).toBeVisible();
    await page.mouse.move(0, 0);
    await expect(notes.nth(1)).toBeHidden();
    await expect(notes.first()).toBeVisible();
  });

  test('a click where the hover note covers the marker keeps the note, and a second click closes it', async ({
    page,
  }) => {
    const block = example(page);
    const marker = block.getByRole('button', { name: 'Annotation 1' });
    const note = block.locator('.scb-annotation-popover').first();
    await marker.hover();
    await expect(note).toBeVisible();
    await expect(note).not.toHaveClass(/scb-annotation-wait/);
    // A real click at the marker, which lands on whatever is on top of it.
    const box = await marker.boundingBox();
    const [x, y] = [(box?.x ?? 0) + (box?.width ?? 0) / 2, (box?.y ?? 0) + (box?.height ?? 0) / 2];
    await page.mouse.click(x, y);
    await page.mouse.move(0, 0);
    await page.waitForTimeout(400);
    await expect(note).toBeVisible();
    await page.mouse.click(x, y);
    await expect(note).toBeHidden();
  });

  test('two notes can be kept open with clicks', async ({ page }) => {
    const block = example(page);
    const notes = block.locator('.scb-annotation-popover');
    for (const n of [1, 2]) {
      const box = await block.getByRole('button', { name: `Annotation ${n}` }).boundingBox();
      await page.mouse.click((box?.x ?? 0) + (box?.width ?? 0) / 2, (box?.y ?? 0) + (box?.height ?? 0) / 2);
    }
    await page.mouse.move(0, 0);
    await page.waitForTimeout(400);
    await expect(notes.nth(0)).toBeVisible();
    await expect(notes.nth(1)).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(notes.nth(0)).toBeHidden();
    await expect(notes.nth(1)).toBeHidden();
  });
});

test('with room after the line, the note opens out of its marker', async ({ page, isMobile }) => {
  test.skip(isMobile, 'A phone has no room beside the line.');
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

test('on a narrow screen, the note is 340px wide at most, centred under its marker', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  const block = example(page);
  for (const n of [1, 2]) {
    const r = await open(block, n);
    await expect(r.note).not.toHaveClass(/scb-annotation-end/);
    expectBelow(r, 360);
    await page.keyboard.press('Escape');
  }
});

test('when the box would cover the code or leave the block, the note opens under its marker', async ({ page }) => {
  const width = page.viewportSize()?.width ?? 0;
  const r = await open(example(page, 1), 1);
  await expect(r.note).not.toHaveClass(/scb-annotation-end/);
  expectBelow(r, width);
});

test('the note moves under its marker when the window gets narrow', async ({ page, isMobile }) => {
  test.skip(isMobile, 'A phone has no room beside the line.');
  const r = await open(example(page), 1);
  await expect(r.note).toHaveClass(/scb-annotation-end/);
  await page.setViewportSize({ width: 360, height: 780 });
  await expect(r.note).not.toHaveClass(/scb-annotation-end/);
});

test('the note opens at once under reduced motion', async ({ page }) => {
  test.skip(!reduced(), 'Only for the reduced-motion project.');
  const { note } = await open(example(page), 1);
  expect(await css(note, 'animationName')).toBe('none');
});

test('several notes can stay open, and Escape closes them, with the keyboard', async ({ page }) => {
  const block = example(page);
  const notes = block.locator('.scb-annotation-popover');
  await block.getByRole('button', { name: 'Annotation 1' }).focus();
  await page.keyboard.press('Enter');
  await expect(notes.nth(0)).toBeVisible();
  const second = block.getByRole('button', { name: 'Annotation 2' });
  await second.focus();
  await page.keyboard.press('Enter');
  await expect(notes.nth(1)).toBeVisible();
  await expect(notes.nth(0)).toBeVisible();
  await expect(notes.nth(1).locator('code')).toHaveText('uv');
  await page.keyboard.press('Escape');
  await expect(notes.nth(1)).toBeHidden();
  await expect(notes.nth(0)).toBeHidden();
  await expect(second).toBeFocused();
});

test('the badge in the note is hidden from screen readers', async ({ page }) => {
  const badge = example(page).locator('.scb-annotation-badge').first();
  await expect(badge).toHaveAttribute('aria-hidden', 'true');
});

test('inline code in a note uses the code font, with round corners in a titled block', async ({ page }) => {
  const block = example(page);
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

test('copying leaves the markers and notes out', async ({ page }) => {
  const copied = await copyFromKeyboard(example(page));
  expect(copied).toContain('python: ["3.12", "3.13"]\n');
  expect(copied).not.toContain('annotate');
  expect(copied).not.toContain('One job');
});

test('the marker fades to the hover colour on the timing of the hover note', async ({ page, isMobile }) => {
  const marker = example(page).locator('.scb-annotation').first();
  const timing = () =>
    marker.evaluate((el) => [getComputedStyle(el).transitionDuration, getComputedStyle(el).transitionDelay]);
  if (reduced()) {
    expect((await timing())[0]).toBe('0s');
    return;
  }
  expect(await timing()).toEqual(['0.16s', '0s']);
  test.skip(isMobile, 'Phones have no hover.');
  const rest = await css(marker, 'backgroundColor');
  await marker.hover();
  expect(await timing()).toEqual(['0.16s', '0.08s']);
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

test('prints the notes as a numbered list under the block', async ({ page }) => {
  const block = example(page);
  await expect(block.locator('.scb-annotation-list')).toBeHidden();
  await page.emulateMedia({ media: 'print' });
  await expect(block.locator('.scb-annotation-list li')).toHaveText([
    'One job per version, run in parallel.',
    'Installs uv and caches its downloads between runs.',
  ]);
  await expect(block.locator('.scb-annotation').first()).toBeHidden();
});

test('a marker keeps its circle in forced colours', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  const marker = example(page).getByRole('button', { name: 'Annotation 1' });
  expect(await css(marker, 'borderTopStyle')).toBe('solid');
  expect(await css(marker, 'borderTopWidth')).toBe('1px');
});
