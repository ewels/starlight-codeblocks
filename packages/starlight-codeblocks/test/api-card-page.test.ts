import { getCssVarName } from '@expressive-code/core';
import { ExpressiveCode } from 'expressive-code';
import { expect, test } from 'vitest';
import { apiCardPageStyles } from '../src/api-card-page.ts';
import { pluginCodeblocks } from '../src/expressive-code/index.ts';
import { apiCardLoader } from '../src/integration.ts';

const variants = new ExpressiveCode({ plugins: pluginCodeblocks() }).styleVariants;
const background = getCssVarName('codeblocks.popoverBackground');

test('gives the card outside code blocks the theme variables of each theme, with the site theme switch', () => {
  const css = apiCardPageStyles(variants);
  const [dark, light] = variants.map((v) => v.cssVarDeclarations.get(background));
  expect(dark).not.toBe(light);
  expect(css).toContain(`.scb-page {\n  ${background}: ${dark};`);
  expect(css).toContain(`:root[data-theme='light'] .scb-page {\n  ${background}: ${light};`);
});

test('scopes the float and card rules to the card outside code blocks', () => {
  const css = apiCardPageStyles(variants);
  expect(css).toContain(':where(.scb-page, .scb-page *).scb-float {\n  position: fixed;');
  expect(css).toContain(':where(.scb-page, .scb-page *).scb-api-card-head {');
  expect(css).toContain(`background: var(${background});`);
  expect(css).toContain(':where(.scb-page, .scb-page *).scb-api-card-action {');
  // Every rule starts with the scope, so nothing reaches cards inside code blocks.
  expect(css.split('\n').filter((line) => /^\.scb-(?!page)/.test(line))).toEqual([]);
});

test('the page loader imports the card module from the assets folder, under the site base', () => {
  const script = apiCardLoader('/docs/', '_astro') ?? '';
  expect(script).toMatch(/^const url = "\/docs\/_astro\/scb-api-links\.[\w-]+\.js";$/m);
  expect(script).toContain('import(/* @vite-ignore */ url)');
  expect(script).toContain("document.querySelector('[data-scb-api-links]')");
  expect(apiCardLoader('/', '_astro')).toMatch(/^const url = "\/_astro\/scb-api-links\./m);
});
