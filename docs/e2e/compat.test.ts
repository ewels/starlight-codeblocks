import { expect, type Locator, type Page, test } from '@playwright/test';

// These tests copy the markup that other Starlight plugins add, so that the docs site needs no such plugin.

const example = (page: Page, n = 0) =>
  page.locator('.example').nth(n).locator('.pane').nth(1).locator('.expressive-code');

/** Copies a block into an overlay, as full screen plugins such as starlight-codeblock-fullscreen do. */
async function copyToOverlay(page: Page, block: Locator) {
  await block.evaluate((el) => {
    const overlay = document.createElement('div');
    overlay.className = 'test-overlay';
    overlay.style.cssText =
      'position: fixed; inset: 0; z-index: 1000; overflow: auto; padding: 2rem; background: Canvas';
    overlay.append(el.cloneNode(true));
    document.body.append(overlay);
  });
  return page.locator('.test-overlay > .expressive-code');
}

test('hidden lines open in a copy of the block, not in the original', async ({ page }) => {
  await page.goto('./features/hidden-lines/');
  const copy = await copyToOverlay(page, example(page));
  await copy.locator('.scb-hidden-marker').first().click();
  await expect(copy.locator('.scb-hidden-line').first()).toBeVisible();
  await expect(example(page).locator('.scb-hidden-line').first()).toBeHidden();
  await copy.locator('.scb-hidden-toggle').click();
  await expect(copy.locator('.scb-hidden-line').last()).toBeVisible();
});

test('an annotation in a copy of the block opens its own popover', async ({ page }) => {
  await page.goto('./features/annotations/');
  const copy = await copyToOverlay(page, example(page));
  await copy.locator('button.scb-annotation').first().click();
  await expect(copy.locator('.scb-annotation-popover:popover-open')).toHaveCount(1);
  await expect(example(page).locator('.scb-annotation-popover:popover-open')).toHaveCount(0);
});

test('a line number in a copy of the block selects the line in the copy', async ({ page }) => {
  await page.goto('./features/line-permalinks/');
  const copy = await copyToOverlay(page, example(page));
  await copy.locator('a.scb-permalink', { hasText: '2' }).click();
  await expect(copy.locator('[id="cfg-L2"]')).toHaveClass(/scb-permalink-target/);
  await expect(example(page).locator('[id="cfg-L2"]')).not.toHaveClass(/scb-permalink-target/);
});

test('an expandable block expands in a copy of the block', async ({ page }) => {
  await page.goto('./features/expandable-blocks/');
  const copy = await copyToOverlay(page, example(page));
  const toggle = copy.locator('.scb-expandable-toggle');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(example(page).locator('.scb-expandable-toggle')).toHaveAttribute('aria-expanded', 'false');
});

test('the Run button runs a copy of the block', async ({ page }) => {
  await page.goto('./features/run-in-the-browser/');
  const copy = await copyToOverlay(page, example(page, 1));
  await copy.locator('.scb-run').click();
  await expect(copy.locator('.scb-run-stdout')).toBeVisible();
  await expect(example(page, 1).locator('.scb-run-output')).toBeEmpty();
});

test('a full screen button in the title bar leaves the step buttons free', async ({ page }) => {
  await page.goto('./features/token-transitions/');
  const current = page.locator('.example').first().locator('[data-scb-steps] > .expressive-code:visible');
  // starlight-codeblock-fullscreen puts its button over the end of the title bar with these styles.
  await current.locator('figcaption.header').evaluate((header) => {
    const button = document.createElement('button');
    button.className = 'cb-fullscreen__button';
    button.style.cssText =
      'position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%); z-index: 100; width: 1.75rem; height: 1.75rem';
    (header as HTMLElement).style.position = 'relative';
    header.append(button);
  });
  await current.getByRole('button', { name: 'Next' }).click({ timeout: 2000 });
  await expect(
    page.locator('.example').first().locator('[data-scb-steps] [aria-current="step"]:visible'),
  ).toHaveAttribute('aria-label', /^Step 2/);
});
