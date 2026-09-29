import { getColorContrast, getFirstStaticColor, mix } from '@expressive-code/core';
import { ExpressiveCode } from 'expressive-code';
import { expect, test } from 'vitest';
import { pluginCore } from '../src/expressive-code/core.ts';
import { toVariants, variants } from './contrast.ts';

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

test('muted text meets 4.5:1 on the tinted surfaces it sits on', async () => {
  for (const { get, name } of await variants()) {
    const muted = get('codeblocks.mutedForeground');
    const bg = get('codeBackground');
    const surfaces = [
      get('codeblocksHiddenLines.badgeBackground'),
      mix(bg, get('codeForeground'), 0.05),
      getFirstStaticColor(get('frames.editorTabBarBackground')),
    ];
    for (const surface of surfaces.filter((s): s is string => !!s)) {
      expect(getColorContrast(muted, surface), `${name} on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
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
  const ec = new ExpressiveCode({ plugins: [pluginCore()], styleOverrides: { codeblocks: { accent: '#ff00ff' } } });
  await ec.getBaseStyles();
  for (const v of toVariants(ec)) {
    expect([v.get('codeblocks.accent'), v.get('codeblocks.focusRing')]).toEqual(['#ff00ff', '#ff00ff']);
  }
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
