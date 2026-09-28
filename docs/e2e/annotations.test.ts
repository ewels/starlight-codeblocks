import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./features/annotations/');
});

const example = (page: import('@playwright/test').Page, n = 0) =>
  page.locator('.example').nth(n).locator('.pane.output').locator('.expressive-code');

test('a marker opens its note under it, with the pointer', async ({ page }) => {
  const block = example(page);
  const marker = block.getByRole('button', { name: 'Annotation 1' });
  const note = block.locator('.scb-annotation-popover').first();
  await expect(note).toBeHidden();
  // With room below, the note opens under the marker.
  await marker.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await marker.click();
  await expect(note).toBeVisible();
  await expect(note).toHaveText('One job per version, run in parallel.');
  const m = await marker.boundingBox();
  const n = await note.boundingBox();
  expect(n && m && n.y).toBeGreaterThan((m?.y ?? 0) + (m?.height ?? 0));
  await page.mouse.click(5, 5);
  await expect(note).toBeHidden();
});

test('opening one note closes the other, and Escape closes it, with the keyboard', async ({ page }) => {
  const block = example(page);
  const notes = block.locator('.scb-annotation-popover');
  await block.getByRole('button', { name: 'Annotation 1' }).focus();
  await page.keyboard.press('Enter');
  await expect(notes.nth(0)).toBeVisible();
  await block.getByRole('button', { name: 'Annotation 2' }).focus();
  await page.keyboard.press('Enter');
  await expect(notes.nth(1)).toBeVisible();
  await expect(notes.nth(0)).toBeHidden();
  await expect(notes.nth(1).locator('code')).toHaveText('uv');
  await page.keyboard.press('Escape');
  await expect(notes.nth(1)).toBeHidden();
});

test('the note is 340px wide, centred under its marker, and 12px inside the viewport', async ({ page }) => {
  const block = example(page);
  const width = page.viewportSize()?.width ?? 0;
  for (const n of [1, 2]) {
    const marker = block.getByRole('button', { name: `Annotation ${n}` });
    await marker.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await marker.click();
    const m = await marker.boundingBox();
    const box = await block
      .locator('.scb-annotation-popover')
      .nth(n - 1)
      .boundingBox();
    if (!m || !box) throw new Error('No marker or note');
    expect(box.width).toBeCloseTo(Math.min(340, width - 24), 0);
    const centred = m.x + m.width / 2 - box.width / 2;
    expect(box.x).toBeCloseTo(Math.min(Math.max(12, centred), width - 12 - box.width), 0);
    expect(box.y - (m.y + m.height)).toBeCloseTo(8, 0);
    await page.keyboard.press('Escape');
  }
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

test('copying leaves the markers and notes out', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await example(page).locator('.copy button').focus();
  await page.keyboard.press('Enter');
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('python: ["3.12", "3.13"]\n');
  expect(copied).not.toContain('annotate');
  expect(copied).not.toContain('One job');
});

test('the marker changes to the hover colour at once, without a fade', async ({ page, isMobile }) => {
  const marker = example(page).locator('.scb-annotation').first();
  expect(await marker.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s');
  test.skip(isMobile, 'Phones have no hover.');
  const rest = await marker.evaluate((el) => getComputedStyle(el).backgroundColor);
  await marker.hover();
  const { hover, expected } = await marker.evaluate((el) => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--ec-codeblocksAnnotations-markerHoverBg)';
    el.after(probe);
    const out = { hover: getComputedStyle(el).backgroundColor, expected: getComputedStyle(probe).color };
    probe.remove();
    return out;
  });
  expect(hover).toBe(expected);
  expect(hover).not.toBe(rest);
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
  expect(await marker.evaluate((el) => getComputedStyle(el).borderTopStyle)).toBe('solid');
  expect(await marker.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe('1px');
});
