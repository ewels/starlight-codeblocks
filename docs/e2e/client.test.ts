import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import ts from 'typescript';
import { loaderSource } from '../../packages/starlight-codeblocks/src/client-modules.ts';
import { floatStyles } from '../../packages/starlight-codeblocks/src/expressive-code/styles.ts';

// A page on its own origin, so that the tests control every file the browser loads.
const origin = 'http://codeblocks.test';

async function serve(page: Page, files: Record<string, string>) {
  const requested: string[] = [];
  await page.route(`${origin}/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    requested.push(path);
    const body = files[path];
    if (body === undefined) return route.fulfill({ status: 404 });
    return route.fulfill({ body, contentType: path.endsWith('.js') ? 'text/javascript' : 'text/html' });
  });
  return requested;
}

test.describe('client module loader', () => {
  const counter = (name: string) =>
    `export default () => { document.body.dataset.${name} = String(Number(document.body.dataset.${name} ?? 0) + 1); };`;
  const modules = [
    { feature: 'alpha', fileName: 'scb-alpha.a1.js', source: counter('alpha') },
    { feature: 'beta', fileName: 'scb-beta.b2.js', source: counter('beta') },
  ];
  const html = '<body><div data-scb-alpha></div><script type="module" src="/_astro/ec.js"></script></body>';

  test('imports only the modules that the page uses, and runs them again on page load', async ({ page }) => {
    const requested = await serve(page, {
      '/': html,
      '/_astro/ec.js': loaderSource(modules, false),
      '/_astro/scb-alpha.a1.js': counter('alpha'),
      '/_astro/scb-beta.b2.js': counter('beta'),
    });
    await page.goto(`${origin}/`);
    await expect(page.locator('body')).toHaveAttribute('data-alpha', '1');
    await page.evaluate(() => document.dispatchEvent(new Event('astro:page-load')));
    await expect(page.locator('body')).toHaveAttribute('data-alpha', '2');
    expect(requested).not.toContain('/_astro/scb-beta.b2.js');
    await expect(page.locator('body')).not.toHaveAttribute('data-beta');
  });

  test('runs inline modules without extra requests', async ({ page }) => {
    const requested = await serve(page, { '/': html, '/_astro/ec.js': loaderSource(modules, true) });
    await page.goto(`${origin}/`);
    await expect(page.locator('body')).toHaveAttribute('data-alpha', '1');
    await expect(page.locator('body')).not.toHaveAttribute('data-beta');
    expect(requested).toEqual(['/', '/_astro/ec.js']);
  });
});

test.describe('positioning helper', () => {
  const position = ts.transpileModule(
    readFileSync(new URL('../../packages/starlight-codeblocks/src/client/shared/position.ts', import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const html = `<style>body { margin: 0 } .expressive-code { ${floatStyles} } #anchor { position: fixed }</style>
<div class="expressive-code">
  <button id="anchor">1</button>
  <div popover id="card" class="scb-float" style="width: 200px; height: 100px; box-sizing: border-box">Note</div>
</div>
<script type="module">import { place } from '/position.js'; window.place = place;</script>`;

  for (const mode of ['anchor positioning', 'script fallback']) {
    test.describe(mode, () => {
      test.beforeEach(async ({ page }) => {
        if (mode === 'script fallback') {
          await page.addInitScript(() => {
            const supports = CSS.supports.bind(CSS);
            CSS.supports = ((property: string, value?: string) =>
              property === 'position-area' ? false : supports(property, value as string)) as typeof CSS.supports;
          });
        }
        await serve(page, { '/': html, '/position.js': position });
        await page.goto(`${origin}/`);
        await page.waitForFunction(() => 'place' in window);
      });

      async function open(page: Page, anchor: { top: string; left: string }) {
        return page.evaluate((style) => {
          const button = document.getElementById('anchor') as HTMLElement;
          const card = document.getElementById('card') as HTMLElement;
          Object.assign(button.style, style);
          card.showPopover();
          (window as unknown as { place: (f: HTMLElement, a: HTMLElement) => void }).place(card, button);
          const rect = (el: Element) => el.getBoundingClientRect().toJSON();
          return { anchor: rect(button), card: rect(card), width: innerWidth, height: innerHeight };
        }, anchor);
      }

      test('opens below the anchor', async ({ page }) => {
        const { anchor, card } = await open(page, { top: '20px', left: '20px' });
        expect(card.top).toBeGreaterThanOrEqual(anchor.bottom);
        expect(card.top - anchor.bottom).toBeLessThanOrEqual(8);
      });

      test('opens above the anchor when there is no room below', async ({ page }) => {
        const { anchor, card } = await open(page, { top: 'calc(100vh - 40px)', left: '20px' });
        expect(card.bottom).toBeLessThanOrEqual(anchor.top);
      });

      test('stays inside the viewport at the right edge', async ({ page }) => {
        const { card, width } = await open(page, { top: '20px', left: 'calc(100vw - 30px)' });
        expect(card.right).toBeLessThanOrEqual(width);
        expect(card.left).toBeGreaterThanOrEqual(0);
      });
    });
  }
});
