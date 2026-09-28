import { getColorContrast } from '@expressive-code/core';
import { ExpressiveCode } from 'expressive-code';
import { expect, test } from 'vitest';
import { pluginCore } from '../src/expressive-code/core.ts';
import { variants } from './contrast.ts';

async function settings(overrides = {}) {
  const ec = new ExpressiveCode({ plugins: [pluginCore()], styleOverrides: overrides });
  await ec.getBaseStyles();
  return ec.styleVariants.map((variant) => ({
    type: variant.theme.type,
    get: (key: string) => variant.resolvedStyleSettings.get(`codeblocks.${key}` as never) as string,
  }));
}

test('every shared colour meets its contrast target in each theme', async () => {
  const all = await variants([pluginCore()]);
  expect(new Set(all.map((v) => v.type))).toEqual(new Set(['dark', 'light']));
  for (const { get: full, name } of all) {
    const get = (key: string) => full(`codeblocks.${key}`);
    const bg = full('codeBackground');
    expect(getColorContrast(get('mutedForeground'), bg), name).toBeGreaterThanOrEqual(4.5);
    expect(getColorContrast(get('accent'), bg), name).toBeGreaterThanOrEqual(3);
    expect(getColorContrast(get('focusRing'), bg), name).toBeGreaterThanOrEqual(3);
    expect(getColorContrast(get('accentHover'), bg), name).toBeGreaterThanOrEqual(3);
    expect(getColorContrast(get('accentForeground'), get('accent')), name).toBeGreaterThanOrEqual(4.5);
    expect(getColorContrast(get('accentForeground'), get('accentHover')), name).toBeGreaterThanOrEqual(4.5);
    expect(get('accentHover'), name).not.toBe(get('accent'));
    expect(getColorContrast(get('popoverForeground'), get('popoverBackground')), name).toBeGreaterThanOrEqual(4.5);
    expect(getColorContrast(get('mutedForeground'), get('popoverBackground')), name).toBeGreaterThanOrEqual(4.5);
    expect(getColorContrast(get('focusRing'), get('popoverBackground')), name).toBeGreaterThanOrEqual(3);
  }
});

test('the shared colours come from the theme, and keep the Night Owl look of the docs site', async () => {
  const all = await variants([pluginCore()]);
  const nightOwl = all.find((v) => v.type === 'dark' && v.name.startsWith('Night Owl'));
  // Night Owl's terminal blue already has the contrast, so it stays as it is.
  expect(nightOwl?.get('codeblocks.accent')).toBe('#82aaff');
  expect(new Set(all.map((v) => v.get('codeblocks.accent'))).size).toBe(all.length);
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
  for (const v of ec.styleVariants) {
    expect(themes).toContain(`--ec-codeblocks-accent:${v.resolvedStyleSettings.get('codeblocks.accent')}`);
  }
});
