import { PluginStyleSettings, setAlpha, type UnresolvedStyleValue } from '@expressive-code/core';
import { h, select } from '@expressive-code/core/hast';
import { clientJsModules } from '../client-modules.ts';
import { uiTexts } from '../translations.ts';
import { addTitleBarControl, blockSetting, type CodeblocksPlugin, parseBoolean } from './core.ts';
import { hasCollapse } from './expandable.ts';
import { PREFIX } from './styles.ts';
import { markerType } from './word-diff.ts';

export interface SplitDiffStyleSettings {
  gapBackground: UnresolvedStyleValue;
}

declare module '@expressive-code/core' {
  export interface StyleSettings {
    codeblocksSplitDiff: SplitDiffStyleSettings;
  }
}

const styleSettings = new PluginStyleSettings({
  defaultValues: {
    codeblocksSplitDiff: {
      gapBackground: ({ resolveSetting }) => setAlpha(resolveSetting('codeblocks.mutedForeground'), 0.08),
    },
  },
});

const S = `${PREFIX}-split`;
const SPLIT = `pre.${S} > code`;

type View = 'unified' | 'split';

/**
 * Adds a Unified and Split switch to the title bar of blocks with removed and added lines. Split shows the old code
 * on the left and the new code on the right. The client module builds it: the rendered HTML stays a unified diff.
 */
export function pluginSplitDiff({
  view: siteView = 'unified',
  switch: siteSwitch = true,
  sync: siteSync = true,
}: {
  view?: View;
  switch?: boolean;
  sync?: boolean;
} = {}): CodeblocksPlugin {
  return {
    name: 'starlight-codeblocks:split-diff',
    styleSettings,
    baseStyles: ({ cssVar }) => `
.${S}-copy, .${S}-gap { display: none; }
${SPLIT} { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
/* Sideways scrolling would hide the right side in a docs column. */
${SPLIT} > .ec-line .code { white-space: pre-wrap; overflow-wrap: anywhere; }
${SPLIT} > * { grid-row: var(--scb-row); grid-column: 1 / -1; }
${SPLIT} > .${S}-left { grid-column: 1; }
${SPLIT} > .${S}-right {
  grid-column: 2;
  box-shadow: inset ${cssVar('borderWidth')} 0 ${cssVar('borderColor')};
}
/* A copy of a hidden line follows the hidden lines rules. */
${SPLIT} > .${S}-copy:not(.${PREFIX}-hidden-line) { display: grid; }
${SPLIT} > .${S}-copy { user-select: none; -webkit-user-select: none; }
${SPLIT} > .${S}-gap { display: block; background: ${cssVar('codeblocksSplitDiff.gapBackground')}; }
${SPLIT} > :is([hidden], .${PREFIX}-hidden-line:not(.${PREFIX}-hidden-open)) + :is(.${S}-copy, .${S}-gap) { display: none; }
.${S}-switch { display: inline-flex; }
.${S}-switch > .${PREFIX}-btn:first-child { border-start-end-radius: 0; border-end-end-radius: 0; }
.${S}-switch > .${PREFIX}-btn:last-child { margin-inline-start: -1px; border-start-start-radius: 0; border-end-start-radius: 0; }
.${S}-toggle[aria-pressed='false'] { background: none; color: ${cssVar('codeblocks.mutedForeground')}; }
.${S}-toggle[aria-pressed='false']:hover { background: color-mix(in srgb, ${cssVar('codeForeground')} 8%, transparent); color: ${cssVar('codeForeground')}; }
.${S}-toggle[aria-pressed='true'] { background: color-mix(in srgb, ${cssVar('codeForeground')} 18%, transparent); }`,
    jsModules: clientJsModules,
    hooks: {
      postprocessRenderedBlock(context) {
        const { codeBlock, renderData } = context;
        if (codeBlock.metaOptions.getBoolean('splitDiff') === false || hasCollapse(codeBlock)) return;
        const types = new Set(codeBlock.getLines().map(markerType));
        const pre = select('pre', renderData.blockAst);
        if (!pre || !types.has('ins') || !types.has('del')) return;
        const view = blockSetting<View>(
          context,
          'splitDiff.view',
          (raw) => (raw === 'unified' || raw === 'split' ? raw : undefined),
          siteView,
          '`"unified"` or `"split"`',
        );
        const hasSwitch = blockSetting(context, 'splitDiff.switch', parseBoolean, siteSwitch, '`true` or `false`');
        const sync = blockSetting(context, 'splitDiff.sync', parseBoolean, siteSync, '`true` or `false`');
        if (!hasSwitch && view === 'unified') return;
        pre.properties.dataScbSplitDiff = view;
        if (!hasSwitch) return;
        // Only these blocks follow the reader's stored choice and each other.
        if (sync) pre.properties.dataScbSplitSync = '';
        const say = uiTexts(context.locale);
        const button = (option: View) =>
          h(
            'button',
            {
              type: 'button',
              class: `${PREFIX}-btn ${S}-toggle`,
              dataScbView: option,
              ariaPressed: String(option === view),
            },
            say(`splitDiff.${option}`),
          );
        addTitleBarControl(
          renderData.blockAst,
          h(
            'span',
            {
              role: 'group',
              ariaLabel: say('splitDiff.view'),
              class: `${S}-switch ${PREFIX}-no-print ${PREFIX}-needs-js`,
            },
            [button('unified'), button('split')],
          ),
          context.locale,
        );
      },
    },
  };
}
