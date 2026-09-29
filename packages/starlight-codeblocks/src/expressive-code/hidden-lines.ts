import {
  AttachedPluginData,
  type ExpressiveCodeBlock,
  type ExpressiveCodeLine,
  onBackground,
  PluginStyleSettings,
  type StyleResolverFn,
  setAlpha,
  type UnresolvedStyleValue,
} from '@expressive-code/core';
import { addClassName, h, select } from '@expressive-code/core/hast';
import { clientJsModules } from '../client-modules.ts';
import { addTitleBarControl, blockUid, type CodeblocksPlugin, insertBefore, lineElement } from './core.ts';
import { markedLines } from './notation.ts';
import { PREFIX, solidCodeBackground, solidCodeForeground } from './styles.ts';

export interface HiddenLinesStyleSettings {
  badgeBackground: UnresolvedStyleValue;
  rule: UnresolvedStyleValue;
  ruleHover: UnresolvedStyleValue;
  ruleOpen: UnresolvedStyleValue;
  openBackground: UnresolvedStyleValue;
  openOpacity: UnresolvedStyleValue;
}

declare module '@expressive-code/core' {
  export interface StyleSettings {
    codeblocksHiddenLines: HiddenLinesStyleSettings;
  }
}

const styleSettings = new PluginStyleSettings({
  defaultValues: {
    codeblocksHiddenLines: {
      badgeBackground: (context: Parameters<StyleResolverFn>[0]) =>
        onBackground(setAlpha(context.resolveSetting('codeblocks.mutedForeground'), 0.1), solidCodeBackground(context)),
      rule: ({ resolveSetting }) => setAlpha(resolveSetting('codeblocks.mutedForeground'), 0.35),
      ruleHover: ({ resolveSetting }) => resolveSetting('codeblocks.mutedForeground'),
      ruleOpen: ({ resolveSetting }) => setAlpha(resolveSetting('codeblocks.mutedForeground'), 0.22),
      openBackground: (context) => setAlpha(solidCodeForeground(context), 0.04),
      openOpacity: '0.75',
    },
  },
});

const hiddenData = new AttachedPluginData<{ lines: Set<ExpressiveCodeLine> }>(() => ({ lines: new Set() }));

/** Whether the hidden lines plugin hides `line`. Known from `preprocessMetadata` on. */
export const isHiddenLine = (codeBlock: ExpressiveCodeBlock, line: ExpressiveCodeLine) =>
  hiddenData.getOrCreateFor(codeBlock).lines.has(line);

const plural = (n: number) => `${n} hidden line${n === 1 ? '' : 's'}`;

/**
 * Hides `hidden={…}` and `[!code hide]` lines behind a marker, and adds a title bar button that
 * shows every run at once. Only the rendered lines are hidden, so the copy button still copies them.
 */
export function pluginHiddenLines(): CodeblocksPlugin {
  return {
    name: 'starlight-codeblocks:hidden-lines',
    directives: {
      'code hide': {
        docs: {
          description: 'Hides the line behind a marker that shows it again.',
          example: { lang: 'js', code: "const host = 'localhost' // [!code hide]\nconst port = 8080" },
          page: 'features/hidden-lines',
        },
      },
    },
    styleSettings,
    baseStyles: ({ cssVar }) => `
.${PREFIX}-hidden-line { display: none; }
.${PREFIX}-hidden-line.${PREFIX}-hidden-open { display: grid; }
.${PREFIX}-hidden-line.${PREFIX}-hidden-open .code {
  background: ${cssVar('codeblocksHiddenLines.openBackground')};
  opacity: ${cssVar('codeblocksHiddenLines.openOpacity')};
}
.${PREFIX}-hidden-marker {
  display: flex;
  align-items: center;
  width: 100%;
  position: relative;
  margin: 2px 0;
  padding: 0;
  border: 0;
  background: none;
  color: ${cssVar('codeblocks.mutedForeground')};
  cursor: pointer;
  font: inherit;
  text-align: left;
  user-select: none;
  -webkit-user-select: none;
}
.${PREFIX}-hidden-marker::before {
  content: '';
  position: absolute;
  top: 50%;
  inset-inline: calc(var(--scb-gutter, 0px) + ${cssVar('codePaddingInline')}) ${cssVar('codePaddingInline')};
  border-top: 1px dashed ${cssVar('codeblocksHiddenLines.rule')};
  transform: translateY(-50%);
}
/* Where the copy button always shows, it sits over the end of the first line. */
@media (hover: none) {
  .${PREFIX}-hidden-marker:first-child::before { inset-inline-end: calc(${cssVar('codePaddingInline')} + 2.5rem); }
}
.${PREFIX}-hidden-marker span {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  /* The gutter width is in ch of the code font; the division undoes this span's smaller font size. */
  margin-inline-start: calc(var(--scb-gutter, 0px) / 0.8125 + ${cssVar('codePaddingInline')});
  padding: 0.05em 0.65em;
  border-radius: 999px;
  background: ${cssVar('codeblocksHiddenLines.badgeBackground')};
  font-size: 0.8125em;
  line-height: 1.6;
}
.${PREFIX}-hidden-marker:hover, .${PREFIX}-hidden-marker:focus-visible {
  color: ${cssVar('codeForeground')};
}
.${PREFIX}-hidden-marker:hover::before { border-top-color: ${cssVar('codeblocksHiddenLines.ruleHover')}; }
.${PREFIX}-hidden-marker[aria-expanded='true']::before { border-top-color: ${cssVar('codeblocksHiddenLines.ruleOpen')}; }
`,
    jsModules: clientJsModules,
    hooks: {
      preprocessCode(context) {
        hiddenData.getOrCreateFor(context.codeBlock).lines = markedLines(context, 'hidden', 'code hide');
      },
      postprocessRenderedBlock(context) {
        const { codeBlock, renderData } = context;
        const { lines: hidden } = hiddenData.getOrCreateFor(codeBlock);
        if (hidden.size === 0) return;
        const code = select('pre > code', renderData.blockAst);
        const figure = select('figure', renderData.blockAst);
        if (!code || !figure) return;
        const lines = codeBlock.getLines();
        const isHidden = (i: number) => hidden.has(lines[i] as ExpressiveCodeLine);
        const uid = blockUid(context);
        const allIds: string[] = [];
        for (let i = 0; i < lines.length; i++) {
          const first = lineElement(lines[i] as ExpressiveCodeLine);
          if (!first || !isHidden(i) || isHidden(i - 1)) continue;
          const ids: string[] = [];
          for (let k = i; isHidden(k); k++) {
            const el = lineElement(lines[k] as ExpressiveCodeLine);
            if (!el) continue;
            // Line permalinks give lines their own ids.
            const id = String(el.properties.id ?? `${PREFIX}-hidden-${uid}-l${k}`);
            el.properties.id = id;
            addClassName(el, `${PREFIX}-hidden-line`);
            addClassName(el, `${PREFIX}-no-print`);
            ids.push(id);
          }
          allIds.push(...ids);
          insertBefore(
            code,
            first,
            h(
              'button',
              {
                type: 'button',
                class: `${PREFIX}-hidden-marker ${PREFIX}-no-print`,
                ariaExpanded: 'false',
                ariaControls: ids.join(' '),
              },
              [h('span', {}, plural(ids.length))],
            ),
          );
        }
        if (allIds.length === 0) return;
        figure.properties.dataScbHiddenLines = '';
        addTitleBarControl(
          figure,
          h(
            'button',
            {
              type: 'button',
              class: `${PREFIX}-btn ${PREFIX}-hidden-toggle ${PREFIX}-no-print ${PREFIX}-needs-js`,
              ariaExpanded: 'false',
              ariaControls: allIds.join(' '),
            },
            `Show ${plural(allIds.length)}`,
          ),
        );
      },
    },
  };
}
