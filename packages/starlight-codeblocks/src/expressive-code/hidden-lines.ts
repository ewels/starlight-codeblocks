import {
  AttachedPluginData,
  type ExpressiveCodeBlock,
  type ExpressiveCodeLine,
  PluginStyleSettings,
  setAlpha,
  type UnresolvedStyleValue,
} from '@expressive-code/core';
import { addClassName, h, select } from '@expressive-code/core/hast';
import { clientJsModules } from '../client-modules.ts';
import { uiTexts } from '../translations.ts';
import { addTitleBarControl, blockUid, type CodeblocksPlugin, insertBefore, lineElement } from './core.ts';
import { markedLines } from './notation.ts';
import { markerColours, markerStyles, PREFIX, solidCodeForeground } from './styles.ts';

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
      ...markerColours,
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
${markerStyles(cssVar, `${PREFIX}-hidden-marker`, `${PREFIX}-hidden-marker span`, 'codeblocksHiddenLines', 'dashed')}
.${PREFIX}-hidden-marker {
  display: flex;
  position: relative;
  width: 100%;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  font: inherit;
  text-align: left;
}
.${PREFIX}-hidden-marker::before {
  inset-inline: calc(var(--scb-gutter, 0px) + ${cssVar('codePaddingInline')}) ${cssVar('codePaddingInline')};
}
/* Where the copy button always shows, it sits over the end of the first line. */
@media (hover: none) {
  .${PREFIX}-hidden-marker:first-child::before { inset-inline-end: calc(${cssVar('codePaddingInline')} + 2.5rem); }
}
.${PREFIX}-hidden-marker span {
  display: inline-flex;
  align-items: center;
  /* The gutter width is in ch of the code font; the division undoes this span's smaller font size. */
  margin-inline-start: calc(var(--scb-gutter, 0px) / 0.8125 + ${cssVar('codePaddingInline')});
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
        const say = uiTexts(context.locale);
        const texts = (closed: string, count: number) =>
          JSON.stringify({ closed, open: say('hiddenLines.hide', { count }) });
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
          const label = say('hiddenLines.marker', { count: ids.length });
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
                dataScbTexts: texts(label, ids.length),
              },
              [h('span', {}, label)],
            ),
          );
        }
        if (allIds.length === 0) return;
        figure.properties.dataScbHiddenLines = '';
        const label = say('hiddenLines.show', { count: allIds.length });
        addTitleBarControl(
          figure,
          h(
            'button',
            {
              type: 'button',
              class: `${PREFIX}-btn ${PREFIX}-hidden-toggle ${PREFIX}-no-print ${PREFIX}-needs-js`,
              ariaExpanded: 'false',
              ariaControls: allIds.join(' '),
              dataScbTexts: texts(label, allIds.length),
            },
            label,
          ),
          context.locale,
        );
      },
    },
  };
}
