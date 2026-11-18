import { expect, test } from '@playwright/test';
import { example } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('./features/skipped-code/');
});

test('a marker starts at the indentation of its directive line, and every marker has the same height', async ({
  page,
}) => {
  const markers = example(page).locator('.scb-skip-marker');
  await expect(markers).toHaveCount(2);
  const result = await example(page)
    .locator('pre code')
    .evaluate((code) => {
      const left = (el: Element) => el.getBoundingClientRect().left;
      const range = document.createRange();
      range.selectNodeContents(code.querySelector('.ec-line .code span') as Node);
      const probe = document.createElement('span');
      probe.textContent = 'xx';
      code.append(probe);
      const ch = probe.getBoundingClientRect().width / 2;
      probe.remove();
      const [indented, plain] = [...code.querySelectorAll('.scb-skip-marker')];
      const text = (marker?: Element) => left(marker?.querySelector('.scb-skip-text') as Element);
      return {
        lineStart: range.getBoundingClientRect().left,
        indented: text(indented),
        plain: text(plain),
        ch,
        heights: [indented, plain].map((m) => m?.getBoundingClientRect().height),
      };
    });
  expect(Math.abs(result.plain - result.lineStart)).toBeLessThan(1);
  expect(Math.abs(result.indented - result.plain - 2 * result.ch)).toBeLessThan(1);
  expect(Math.abs((result.heights[0] ?? 0) - (result.heights[1] ?? 0))).toBeLessThan(1);
});

test('a manual selection copies each marker as its comment, as the copy button does', async ({ page }) => {
  const { selected, copied } = await example(page)
    .locator('figure')
    .evaluate((figure) => {
      getSelection()?.selectAllChildren(figure.querySelector('pre code') as Node);
      return {
        selected: getSelection()?.toString(),
        copied: figure.querySelector('button[data-code]')?.getAttribute('data-code')?.replaceAll('\x7F', '\n'),
      };
    });
  expect(selected).toContain('  // Not shown: Read the users from the database\n');
  expect(selected).not.toContain('Code not shown');
  expect(selected?.trimEnd()).toBe(copied?.trimEnd());
});

test('a marker line hides its comment and shows its text', async ({ page }) => {
  const line = example(page).locator('.scb-skip-line').first();
  await expect(line.locator('.scb-skip-source')).toHaveCSS('clip-path', 'inset(50%)');
  await expect(line.locator('.scb-skip-text')).toBeVisible();
});
