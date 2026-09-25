import { getColorContrast } from '@expressive-code/core';
import { ExpressiveCode } from 'expressive-code';
import { expect, test } from 'vitest';
import { pluginCore } from '../src/expressive-code/core.ts';

// Code backgrounds of Starlight's default themes and of Expressive Code's defaults, by theme type.
const backgrounds = { dark: ['#23262f', '#24292e'], light: ['#f6f7f9', '#ffffff'] };

async function settings(overrides = {}) {
  const ec = new ExpressiveCode({ plugins: [pluginCore()], styleOverrides: overrides });
  await ec.getBaseStyles();
  return ec.styleVariants.map((variant) => ({
    type: variant.theme.type,
    get: (key: string) => variant.resolvedStyleSettings.get(`codeblocks.${key}` as never) as string,
  }));
}

test('every shared colour meets its contrast target in the dark and the light theme', async () => {
  const variants = await settings();
  expect(variants.map((v) => v.type).sort()).toEqual(['dark', 'light']);
  for (const v of variants) {
    for (const bg of backgrounds[v.type]) {
      expect(getColorContrast(v.get('mutedForeground'), bg)).toBeGreaterThanOrEqual(4.5);
      expect(getColorContrast(v.get('accent'), bg)).toBeGreaterThanOrEqual(3);
      expect(getColorContrast(v.get('focusRing'), bg)).toBeGreaterThanOrEqual(3);
    }
    expect(getColorContrast(v.get('accentForeground'), v.get('accent'))).toBeGreaterThanOrEqual(4.5);
    expect(getColorContrast(v.get('popoverForeground'), v.get('popoverBackground'))).toBeGreaterThanOrEqual(4.5);
    expect(getColorContrast(v.get('focusRing'), v.get('popoverBackground'))).toBeGreaterThanOrEqual(3);
  }
});

test('sites can override shared settings with styleOverrides', async () => {
  const variants = await settings({ codeblocks: { accent: '#ff00ff' } });
  expect(variants.map((v) => v.get('accent'))).toEqual(['#ff00ff', '#ff00ff']);
  expect(variants.map((v) => v.get('focusRing'))).toEqual(['#ff00ff', '#ff00ff']);
});

test('base styles use the shared settings and scope to Expressive Code', async () => {
  const ec = new ExpressiveCode({ plugins: [pluginCore()] });
  const css = await ec.getBaseStyles();
  expect(css).toContain('.expressive-code .scb-float');
  expect(css).toContain('var(--ec-codeblocks-popoverBg)');
  expect(css).toContain('prefers-reduced-motion: reduce');
  const themes = await ec.getThemeStyles();
  expect(themes).toContain('--ec-codeblocks-accent:#82aaff');
  expect(themes).toContain('--ec-codeblocks-accent:#3b61b0');
});
