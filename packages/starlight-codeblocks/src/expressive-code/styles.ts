import { PluginStyleSettings, type ResolverContext, type UnresolvedStyleValue } from '@expressive-code/core';

/** Every class and data attribute of the plugin starts with this, as `scb-…` and `data-scb-…`. */
export const PREFIX = 'scb';

export interface CodeblocksStyleSettings {
  /** Markers, numbered buttons and active states. Needs 3:1 contrast on the code background. */
  accent: UnresolvedStyleValue;
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

// The dark values are the mockup colours. The light values give the same contrast on light themes.
export const styleSettings = new PluginStyleSettings({
  defaultValues: {
    codeblocks: {
      accent: ['#82aaff', '#3b61b0'],
      accentForeground: ['#0e1628', '#ffffff'],
      mutedForeground: ['#95a2b5', '#5b6474'],
      focusRing: ({ resolveSetting }) => resolveSetting('codeblocks.accent'),
      popoverBackground: ['#2c3450', '#ffffff'],
      popoverForeground: ['#d6deeb', '#1f2c3c'],
      popoverBorder: ['#4b5783', '#b4bfd3'],
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
  margin-block: 6px;
  margin-inline: 0;
  position-area: block-end span-inline-end;
  position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline;
}`;

export function baseStyles({ cssVar }: ResolverContext) {
  return `${floatStyles}
.${PREFIX}-float {
  box-sizing: border-box;
  max-width: min(${cssVar('codeblocks.popoverMaxWidth')}, calc(100vw - 16px));
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
.is-terminal .${PREFIX}-tools {
  position: absolute;
  inset-block: 0;
  inset-inline-end: 0;
}
/* Without a title or a terminal frame, Expressive Code hides the header. Give it a minimal bar for the controls. */
.frame:not(.has-title):not(.is-terminal):has(.${PREFIX}-tools) {
  --button-spacing: 2.1rem;
}
.frame:not(.has-title):not(.is-terminal):has(.${PREFIX}-tools) .header {
  display: flex;
  align-items: center;
  min-height: 1.9rem;
  padding-inline: ${cssVar('uiPaddingInline')} 0;
  background: color-mix(in srgb, ${cssVar('codeForeground')} 5%, ${cssVar('codeBackground')});
  border-bottom: ${cssVar('borderWidth')} solid ${cssVar('borderColor')};
}
.${PREFIX}-btn {
  display: inline-block;
  text-decoration: none;
  line-height: 1.4;
  border: 1px solid color-mix(in srgb, ${cssVar('codeForeground')} 16%, transparent);
  border-radius: 4px;
  padding: 3px 8px;
  background: color-mix(in srgb, ${cssVar('codeForeground')} 6%, transparent);
  cursor: pointer;
  font: inherit;
  font-size: 0.75rem;
  color: ${cssVar('codeForeground')};
}
.${PREFIX}-btn:hover, .${PREFIX}-btn:focus-visible {
  background: color-mix(in srgb, ${cssVar('codeForeground')} 13%, transparent);
}
:where([class^='${PREFIX}-'], [class*=' ${PREFIX}-']):focus-visible {
  outline: 2px solid ${cssVar('codeblocks.focusRing')};
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  [class^='${PREFIX}-'], [class*=' ${PREFIX}-'], [class^='${PREFIX}-'] *, [class*=' ${PREFIX}-'] * {
    transition: none !important;
    animation: none !important;
  }
}
@media print {
  .${PREFIX}-no-print { display: none !important; }
}`;
}
