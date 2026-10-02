import { getCssVarName } from '@expressive-code/core';
import { ExpressiveCode } from 'expressive-code';
import { expect, test } from 'vitest';
import { apiCardPageStyles } from '../src/api-card-page.ts';
import { pluginCodeblocks } from '../src/expressive-code/index.ts';
import { apiCardLoader, jsAssetsPrefix } from '../src/integration.ts';

const variants = new ExpressiveCode({ plugins: pluginCodeblocks() }).styleVariants;
const background = getCssVarName('codeblocks.popoverBackground');

test('gives the card outside code blocks the variables of each theme, with every rule in its own scope', () => {
  const css = apiCardPageStyles(variants);
  const [dark, light] = variants.map((v) => v.cssVarDeclarations.get(background));
  expect(dark).not.toBe(light);
  expect(css).toContain(`.scb-page {\n  ${background}: ${dark};`);
  expect(css).toContain(`:root[data-theme='light'] .scb-page {\n  ${background}: ${light};`);
  expect(css).toContain(':where(.scb-page, .scb-page *).scb-api-card-head {');
  // Nothing may reach the cards inside code blocks.
  expect(css.split('\n').filter((line) => /^\.scb-(?!page)/.test(line))).toEqual([]);
});

test('the page loader imports the card module from the assets folder, under the site base or the assets prefix', () => {
  const script = apiCardLoader('/docs/', '_astro') ?? '';
  expect(script).toMatch(/^\s*const url = "\/docs\/_astro\/scb-api-links\.[\w-]+\.js";$/m);
  expect(script).toContain('import(/* @vite-ignore */ url)');
  expect(script).toContain("document.querySelector('[data-scb-api-links]')");
  expect(apiCardLoader('https://cdn.example.com/', '_astro')).toMatch(
    /^\s*const url = "https:\/\/cdn\.example\.com\/_astro\/scb-api-links\./m,
  );
  expect(jsAssetsPrefix(undefined)).toBeUndefined();
  expect(jsAssetsPrefix('https://cdn.example.com')).toBe('https://cdn.example.com');
  expect(jsAssetsPrefix({ js: 'https://js.example.com', fallback: 'https://cdn.example.com' })).toBe(
    'https://js.example.com',
  );
  expect(jsAssetsPrefix({ css: 'https://css.example.com', fallback: 'https://cdn.example.com' })).toBe(
    'https://cdn.example.com',
  );
});
