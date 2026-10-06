import mdx from '@astrojs/mdx';
import nightOwlDark from '@shikijs/themes/night-owl';
import nightOwlLight from '@shikijs/themes/night-owl-light';
import { defineConfig } from 'astro/config';
import { ExpressiveCodeTheme } from 'astro-expressive-code';
import codeblocks from 'starlight-codeblocks/astro';

/** Night Owl with the code block colours of Starlight, so that this site looks like the docs. */
function starlightTheme(input) {
  const theme = new ExpressiveCodeTheme(input);
  const dark = theme.type === 'dark';
  const border = 'color-mix(in srgb, var(--sl-color-gray-5), transparent 25%)';
  const bar = dark ? 'var(--sl-color-black)' : 'var(--sl-color-gray-6)';
  const editor = dark ? 'var(--sl-color-gray-6)' : 'var(--sl-color-gray-7)';
  theme.bg = dark ? '#23262f' : '#f6f7f9';
  Object.assign(theme.colors, {
    'editor.background': theme.bg,
    'titleBar.border': border,
    'editorGroupHeader.tabsBorder': border,
    'titleBar.activeBackground': bar,
    'editorGroupHeader.tabsBackground': bar,
    'titleBar.activeForeground': 'var(--sl-color-text)',
    'tab.activeForeground': 'var(--sl-color-text)',
    'tab.activeBorder': 'transparent',
    'tab.activeBorderTop': dark ? 'var(--sl-color-accent-high)' : 'var(--sl-color-accent)',
  });
  theme.styleOverrides.frames = {
    editorBackground: editor,
    terminalBackground: editor,
    editorActiveTabBackground: editor,
    terminalTitlebarDotsForeground: border,
    inlineButtonForeground: 'var(--sl-color-text)',
    frameBoxShadowCssValue: 'none',
  };
  return theme;
}

export default defineConfig({
  integrations: [
    codeblocks({
      codeTabs: {},
      inlineHighlighting: {},
      expressiveCode: {
        themes: [starlightTheme(nightOwlDark), starlightTheme(nightOwlLight)],
        styleOverrides: { borderRadius: 'var(--radius)', codeFontFamily: 'var(--sl-font-system-mono)' },
      },
    }),
    mdx(),
  ],
});
