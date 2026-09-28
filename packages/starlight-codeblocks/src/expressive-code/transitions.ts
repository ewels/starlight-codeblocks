import { PluginStyleSettings, setAlpha, type UnresolvedStyleValue } from '@expressive-code/core';
import { h, select } from '@expressive-code/core/hast';
import type { CodeblocksPlugin } from './core.ts';
import { PREFIX } from './styles.ts';

export interface TransitionsStyleSettings {
  stepBorder: UnresolvedStyleValue;
  doneForeground: UnresolvedStyleValue;
  line: UnresolvedStyleValue;
  duration: UnresolvedStyleValue;
  newLineBackground: UnresolvedStyleValue;
  newLineDuration: UnresolvedStyleValue;
  /** The index of the theme, so that animated tokens can pick their `--0` or `--1` colour. Do not override it. */
  themeIndex: UnresolvedStyleValue;
}

declare module '@expressive-code/core' {
  export interface StyleSettings {
    codeblocksTransitions: TransitionsStyleSettings;
  }
}

const styleSettings = new PluginStyleSettings({
  defaultValues: {
    codeblocksTransitions: {
      stepBorder: ['#6b7894', '#7b8599'],
      doneForeground: ['#cfdcff', '#2c4a8c'],
      line: ['#3f4860', '#c9ced8'],
      duration: '500ms',
      // The theme's own green, from its terminal colours, which every theme defines.
      newLineBackground: ({ theme }) => setAlpha(theme.colors['terminal.ansiGreen'] ?? theme.fg, 0.3),
      newLineDuration: '1000ms',
      themeIndex: ({ styleVariantIndex }) => String(styleVariantIndex),
    },
  },
});

const S = `${PREFIX}-steps`;

/**
 * Shows the `step="…"` label after the title, and styles the numbered steps that `<CodeSteps>` adds to the
 * title bar and the Previous/Next/counter row it adds under the block.
 */
export function pluginTransitions(): CodeblocksPlugin {
  return {
    name: 'starlight-codeblocks:transitions',
    styleSettings,
    baseStyles: ({ cssVar }) => `
.${S}-head {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding-inline: 14px;
}
.frame:not(.has-title) .${S}-head { padding-inline-start: 0; }
.${S}-stepper { display: flex; align-items: center; }
.${S}-dot {
  box-sizing: border-box;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1.5px solid ${cssVar('codeblocksTransitions.stepBorder')};
  border-radius: 50%;
  background: ${cssVar('codeBackground')};
  color: ${cssVar('codeblocks.mutedForeground')};
  font: 600 11px/1 ${cssVar('codeFontFamily')};
  cursor: pointer;
}
.${S}-dot.${S}-done {
  border-color: ${cssVar('codeblocks.accent')};
  color: ${cssVar('codeblocksTransitions.doneForeground')};
}
.${S}-dot[aria-current] {
  background: ${cssVar('codeblocks.accent')};
  color: ${cssVar('codeblocks.accentForeground')};
}
.${S}-dot:hover { border-color: ${cssVar('codeblocks.accentHover')}; }
@media (forced-colors: active) {
  .${S}-dot[aria-current] { forced-color-adjust: none; border-color: Highlight; background: Highlight; color: HighlightText; }
}
.${S}-line {
  width: 18px;
  height: 2px;
  background: ${cssVar('codeblocksTransitions.line')};
}
.${S}-line.${S}-done { background: ${cssVar('codeblocks.accent')}; }
.${S}-label {
  overflow: hidden;
  color: ${cssVar('codeblocks.mutedForeground')};
  font-size: 0.75rem;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.${S}-anim {
  flex: 1 0 100%;
  box-sizing: border-box;
  padding: ${cssVar('codePaddingBlock')} ${cssVar('codePaddingInline')};
  color: ${cssVar('codeForeground')};
  font-family: ${cssVar('codeFontFamily')};
  font-size: ${cssVar('codeFontSize')};
  font-weight: ${cssVar('codeFontWeight')};
  line-height: ${cssVar('codeLineHeight')};
}
.${S}-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.5rem 0.75rem;
  padding-block-start: 12px;
}
.${S}-count {
  color: ${cssVar('codeblocks.mutedForeground')};
  font: 0.8125rem/1.4 ${cssVar('uiFontFamily')};
}
.${S}-nav {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  min-height: 2rem;
  min-width: 2rem;
  padding: 0.25rem 0.9rem;
  border: 1px solid ${cssVar('codeblocksTransitions.stepBorder')};
  border-radius: 999px;
  background: ${cssVar('codeBackground')};
  color: ${cssVar('codeForeground')};
  font: 600 0.8125rem/1.3 ${cssVar('uiFontFamily')};
  cursor: pointer;
}
.${S}-nav:hover:not(:disabled) { border-color: ${cssVar('codeblocks.accent')}; }
.${S}-nav:disabled { opacity: 0.45; cursor: default; }
.${S}-nav-icon { font-size: 1rem; line-height: 1; }
/* magic-move sets a unitless \`--smm-stagger: 0\` on its container, which makes its phase delays invalid. */
.${S}-move > * { --smm-stagger: 0ms; }
.${S}-anim { position: relative; }
.${S}-anim > .${S}-new {
  position: absolute;
  inset-inline: 0;
  top: calc(${cssVar('codePaddingBlock')} + var(--scb-steps-line) * 1lh);
  height: 1lh;
  pointer-events: none;
}
.${S}-new { animation: scb-steps-new ${cssVar('codeblocksTransitions.newLineDuration')} ease-out; }
@keyframes scb-steps-new {
  from { background-color: ${cssVar('codeblocksTransitions.newLineBackground')}; }
  55% { background-color: color-mix(in srgb, ${cssVar('codeblocksTransitions.newLineBackground')} 47%, transparent); }
  to { background-color: transparent; }
}
@container (max-width: 480px) {
  .${S}-line { width: 10px; }
}
@media screen and (scripting: enabled) {
  @container (max-width: 480px) {
    .${S}-head:has(> .${S}-stepper) > .${S}-label { display: none; }
  }
}
@media (scripting: none) {
  .${S}-stepper, .${S}-controls { display: none; }
}`,
    hooks: {
      postprocessRenderedBlock({ codeBlock, renderData }) {
        const label = codeBlock.metaOptions.getString('step');
        if (label === undefined) return;
        const header = select('.header', renderData.blockAst);
        if (!header) return;
        const title = select('.title', header);
        const head = h('span', { class: `${S}-head` }, [h('span', { class: `${S}-label` }, label)]);
        header.children.splice(title ? header.children.indexOf(title) + 1 : 0, 0, head);
      },
    },
  };
}
