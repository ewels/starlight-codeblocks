import { readdirSync, readFileSync } from 'node:fs';
import { type Locator, type Page, test } from '@playwright/test';

/** The "Readers see" pane of the nth `<Example>` on the page. */
export const output = (page: Page, n = 0) => page.locator('.example').nth(n).locator('.pane.output');

/** The rendered code block in the "Readers see" pane of the nth `<Example>`. */
export const example = (page: Page, n = 0) => output(page, n).locator('.expressive-code');

export const reduced = () => test.info().project.name === 'reduced-motion';
export const phone = () => test.info().project.name.startsWith('phone');

/** Runs the test in one project only, for behaviour that does not depend on the viewport, theme or motion. */
export const once = () => test.skip(test.info().project.name !== 'desktop-light', 'The same in every project.');

/** Runs the test in the light projects only, for layout that does not depend on the theme or motion. */
export const lightOnly = () =>
  test.skip(!test.info().project.name.endsWith('-light'), 'Layout does not depend on the theme or motion.');

/** The path of every page in the built site's sitemap, relative to the base. */
export const sitePages = [
  ...readFileSync(new URL('../dist/sitemap-0.xml', import.meta.url), 'utf8').matchAll(
    /<loc>[^<]*?\/starlight-codeblocks\/([^<]*)<\/loc>/g,
  ),
].map(([, path]) => path ?? '');

/** One computed style property of the element, read once. */
export const css = (locator: Locator, property: keyof CSSStyleDeclaration & string) =>
  locator.evaluate((el, p) => String(getComputedStyle(el)[p]), property);

export const clipboard = (page: Page) => page.evaluate(() => navigator.clipboard.readText());

/** Presses the block's copy button from the keyboard and returns what it copied. */
export async function copyFromKeyboard(block: Locator) {
  await block.locator('.copy button').focus();
  await block.page().keyboard.press('Enter');
  return clipboard(block.page());
}

/** Serves `html` for every page under `origin`, and the built client module `scb-<name>` for every script. */
export async function serveClient(page: Page, origin: string, name: string, html: string) {
  const dir = new URL('../../packages/starlight-codeblocks/dist/client/', import.meta.url);
  const file = readdirSync(dir).find((file) => file.startsWith(`scb-${name}.`)) as string;
  const script = readFileSync(new URL(file, dir), 'utf8');
  await page.route(`${origin}/**`, (route) =>
    route.request().url().endsWith('.js')
      ? route.fulfill({ body: script, contentType: 'text/javascript' })
      : route.fulfill({ body: html, contentType: 'text/html' }),
  );
}

/** The WCAG contrast ratio of two CSS colours, measured in the page. */
export function contrast(page: Page, a: string, b: string): Promise<number> {
  return page.evaluate(
    ([a, b]) => {
      const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
      const luminance = (colour: string) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = colour;
        ctx.fillRect(0, 0, 1, 1);
        const [r = 0, g = 0, b = 0] = [...ctx.getImageData(0, 0, 1, 1).data].map((v) => {
          const c = v / 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
      return (high + 0.05) / (low + 0.05);
    },
    [a, b],
  );
}
