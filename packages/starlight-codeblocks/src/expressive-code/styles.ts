import {
  ensureColorContrastOnBackground,
  getFirstStaticColor,
  lighten,
  mix,
  PluginStyleSettings,
  type ResolverContext,
  type StyleResolverFn,
  type UnresolvedStyleValue,
} from '@expressive-code/core';

/** Every class and data attribute of the plugin starts with this, as `scb-…` and `data-scb-…`. */
export const PREFIX = 'scb';

export interface CodeblocksStyleSettings {
  /** Markers, numbered buttons and active states. Needs 3:1 contrast on the code background. */
  accent: UnresolvedStyleValue;
  /** Markers and step borders under the pointer: `accent` moved towards the code foreground. */
  accentHover: UnresolvedStyleValue;
  /** Text on an `accent` background. */
  accentForeground: UnresolvedStyleValue;
  /** Secondary text, such as output and marker labels. Needs 4.5:1 contrast on the code background. */
  mutedForeground: UnresolvedStyleValue;
  focusRing: UnresolvedStyleValue;
  popoverBackground: UnresolvedStyleValue;
  popoverForeground: UnresolvedStyleValue;
  popoverBorder: UnresolvedStyleValue;
  popoverShadow: UnresolvedStyleValue;
  popoverRadius: UnresolvedStyleValue;
  popoverMaxWidth: UnresolvedStyleValue;
  popoverFontSize: UnresolvedStyleValue;
}

declare module '@expressive-code/core' {
  export interface StyleSettings {
    codeblocks: CodeblocksStyleSettings;
  }
}

/**
 * The code background as a colour, for contrast sums. Themes such as starlight-theme-black set it to a CSS
 * variable, which the sums cannot read, so the theme background stands in.
 */
export const solidCodeBackground = ({ resolveSetting, theme }: Parameters<StyleResolverFn>[0]) =>
  getFirstStaticColor(resolveSetting('codeBackground'), theme.bg) ?? (theme.type === 'dark' ? '#202020' : '#ffffff');

/** The code foreground as a colour, for the same reason as `solidCodeBackground`. */
export const solidCodeForeground = ({ resolveSetting, theme }: Parameters<StyleResolverFn>[0]) =>
  getFirstStaticColor(resolveSetting('codeForeground'), theme.fg) ?? (theme.type === 'dark' ? '#d6deeb' : '#403f53');

type Context = Parameters<StyleResolverFn>[0];

/**
 * The first of `keys` in the theme's colours, such as `terminal.ansiBlue`. Expressive Code fills in the VS Code
 * default for most colours a theme leaves out; the code foreground stands in for the rest.
 */
export const themeColour = ({ theme }: Context, ...keys: string[]) =>
  keys.map((key) => theme.colors[key]).find((colour) => colour && !colour.startsWith('var(')) ?? theme.fg;

/** `colour`, lightened or darkened to at least `min` contrast on the code background. */
export const onCode = (context: Context, colour: string, min: number) =>
  ensureColorContrastOnBackground(colour, solidCodeBackground(context), min);

/** A hover colour for `colour`: lighter in dark themes and darker in light themes, as it moves towards the text. */
export const hoverColour = (colour: string, context: Parameters<StyleResolverFn>[0]) =>
  mix(colour, solidCodeForeground(context), 0.45);

// Every colour comes from the theme, so that any Expressive Code theme, dark or light, keeps its look and contrast.
export const styleSettings = new PluginStyleSettings({
  defaultValues: {
    codeblocks: {
      accent: (context) => onCode(context, themeColour(context, 'terminal.ansiBlue'), 4.5),
      accentHover: (context) => hoverColour(context.resolveSetting('codeblocks.accent'), context),
      accentForeground: (context) =>
        ensureColorContrastOnBackground(solidCodeBackground(context), context.resolveSetting('codeblocks.accent'), 4.5),
      mutedForeground: (context) =>
        ensureColorContrastOnBackground(
          onCode(context, mix(solidCodeForeground(context), solidCodeBackground(context), 0.3), 4.5),
          context.resolveSetting('codeblocks.popoverBackground'),
          4.5,
        ),
      focusRing: ({ resolveSetting }) => resolveSetting('codeblocks.accent'),
      popoverBackground: (context) =>
        context.theme.type === 'dark'
          ? mix(solidCodeBackground(context), context.resolveSetting('codeblocks.accent'), 0.12)
          : lighten(solidCodeBackground(context), 0.5),
      popoverForeground: (context) =>
        ensureColorContrastOnBackground(
          solidCodeForeground(context),
          context.resolveSetting('codeblocks.popoverBackground'),
          4.5,
        ),
      popoverBorder: ({ resolveSetting }) =>
        mix(resolveSetting('codeblocks.popoverBackground'), resolveSetting('codeblocks.accent'), 0.3),
      popoverShadow: ['0 8px 28px rgb(10 14 24 / 0.45)', '0 8px 28px rgb(12 20 36 / 0.18)'],
      popoverRadius: '6px',
      popoverMaxWidth: '340px',
      popoverFontSize: '0.8125rem',
    },
  },
});

/** Layout of popovers and hover cards. `place()` in `src/client/shared/position.ts` positions them. */
export const floatStyles = `.${PREFIX}-float {
  position: fixed;
  inset: auto;
  margin: 8px 12px;
  position-area: block-end;
  justify-self: anchor-center;
  position-try-fallbacks: flip-block;
}`;

export function baseStyles({ cssVar }: ResolverContext) {
  return `${floatStyles}
.${PREFIX}-float {
  box-sizing: border-box;
  width: min(var(--scb-float-width, ${cssVar('codeblocks.popoverMaxWidth')}), calc(100vw - 24px));
  padding: 0.5rem 0.75rem;
  background: ${cssVar('codeblocks.popoverBackground')};
  color: ${cssVar('codeblocks.popoverForeground')};
  border: 1px solid ${cssVar('codeblocks.popoverBorder')};
  border-radius: ${cssVar('codeblocks.popoverRadius')};
  box-shadow: ${cssVar('codeblocks.popoverShadow')};
  font-family: ${cssVar('uiFontFamily')};
  font-size: ${cssVar('codeblocks.popoverFontSize')};
  line-height: 1.5;
  white-space: normal;
}
.${PREFIX}-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
.${PREFIX}-tools {
  display: flex;
  align-items: center;
  align-self: center;
  gap: 6px;
  margin-inline-start: auto;
  padding-inline: 8px;
}
/* Centred between the outer top edge and the line under the bar, as in titled bars. */
.is-terminal .${PREFIX}-tools {
  position: absolute;
  inset-block: calc(-1 * ${cssVar('borderWidth')}) ${cssVar('borderWidth')};
  inset-inline-end: 0;
}
/* starlight-codeblock-fullscreen puts its button over the end of the title bar. */
.header:has(> .cb-fullscreen__button) .${PREFIX}-tools { margin-inline-end: 2.25rem; }
/* Without a title or a terminal frame, Expressive Code hides the header. Give it a minimal bar for the controls. */
.frame:not(.has-title):not(.is-terminal):has(.${PREFIX}-tools, .${PREFIX}-steps-head) {
  --button-spacing: calc(1.9rem + 2 * (${cssVar('uiPaddingBlock')} + ${cssVar('frames.editorActiveTabIndicatorHeight')}));
}
.frame:not(.has-title):not(.is-terminal):has(.${PREFIX}-tools, .${PREFIX}-steps-head) .header {
  display: flex;
  align-items: center;
  /* The height of Expressive Code's editor tab bar, so that untitled blocks match titled ones. */
  min-height: calc(${cssVar('uiFontSize')} * ${cssVar('uiLineHeight')} + 2 * (${cssVar('uiPaddingBlock')} + ${cssVar('frames.editorActiveTabIndicatorHeight')}) + ${cssVar('borderWidth')});
  box-sizing: border-box;
  padding-inline: ${cssVar('uiPaddingInline')} 0;
  background: color-mix(in srgb, ${cssVar('codeForeground')} 5%, ${cssVar('codeBackground')});
  /* The top border of the code is the line under the bar. */
  border: ${cssVar('borderWidth')} solid ${cssVar('borderColor')};
  border-bottom: 0;
  border-radius: ${cssVar('borderRadius')} ${cssVar('borderRadius')} 0 0;
}
/* The bar's own border counts towards the 8px end gap, as the frame border does in titled bars. */
.frame:not(.has-title):not(.is-terminal) .header > .${PREFIX}-tools {
  margin-block-start: calc(-1 * ${cssVar('borderWidth')});
  padding-inline-end: calc(8px - ${cssVar('borderWidth')});
}
.${PREFIX}-btn {
  display: inline-block;
  text-decoration: none;
  border: 1px solid color-mix(in srgb, ${cssVar('codeForeground')} 14%, transparent);
  border-radius: 4px;
  padding: 3px 8px;
  background: color-mix(in srgb, ${cssVar('codeForeground')} 6%, transparent);
  cursor: pointer;
  font: 0.75rem/1.4 ${cssVar('codeFontFamily')};
  color: ${cssVar('codeForeground')};
}
.${PREFIX}-btn:hover {
  background: color-mix(in srgb, ${cssVar('codeForeground')} 13%, transparent);
}
/* The + and - markers of diff lines sit in the padding, which leaves no gap before the code. */
pre:has(> code > .ec-line:is(.ins, .del)) .ec-line .code {
  padding-inline-start: calc(var(--ecIndent, 0ch) + ${cssVar('codePaddingInline')} + 1ch - var(--ecGtrBrdWd));
}
/* Expressive Code's own focus border can fall under 3:1 contrast on the code. */
pre:focus-visible {
  outline-color: ${cssVar('codeblocks.focusRing')};
}
:where([class^='${PREFIX}-'], [class*=' ${PREFIX}-']):focus-visible {
  outline: 2px solid ${cssVar('codeblocks.focusRing')};
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  [class^='${PREFIX}-'], [class*=' ${PREFIX}-'], [class^='${PREFIX}-'] *, [class*=' ${PREFIX}-'] *,
  .copy button, .copy button div, .copy .feedback {
    transition: none !important;
    animation: none !important;
  }
}
@media (scripting: none) {
  .${PREFIX}-needs-js { display: none; }
  /* The minimal bar has nothing left to show. */
  .frame:not(.has-title):not(.is-terminal):has(.${PREFIX}-tools):not(:has(.${PREFIX}-tools > :not(.${PREFIX}-needs-js), .${PREFIX}-steps-head)) .header { display: none; }
}
@media print {
  .${PREFIX}-no-print { display: none !important; }
}`;
}
