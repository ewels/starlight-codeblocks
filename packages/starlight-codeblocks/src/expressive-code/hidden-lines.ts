import { AttachedPluginData, type ExpressiveCodeLine } from '@expressive-code/core';
import { addClassName, type ElementContent, h, select, selectAll } from '@expressive-code/core/hast';
import { clientJsModules } from '../client-modules.ts';
import { type CodeblocksPlugin, resolveRange } from './core.ts';
import { getDirectives } from './notation.ts';
import { PREFIX } from './styles.ts';

const hiddenData = new AttachedPluginData<{ lines: Set<ExpressiveCodeLine> }>(() => ({ lines: new Set() }));

const plural = (n: number) => `${n} hidden line${n === 1 ? '' : 's'}`;

/**
 * Hides `hidden={…}` and `[!code hide]` lines behind a marker, and adds a title bar button that
 * shows every run at once. The copy button still copies hidden lines (SPEC 5): they stay in the
 * code, only their rendered line is hidden with CSS.
 */
export function pluginHiddenLines(): CodeblocksPlugin {
  return {
    name: 'starlight-codeblocks:hidden-lines',
    directives: {
      'code hide': {
        placement: 'end',
        docs: {
          description: 'Hides the line behind a marker that shows it again.',
          example: 'import unused_helper  // [!code hide]',
          page: 'features/hidden-lines',
        },
      },
    },
    baseStyles: ({ cssVar }) => `
.${PREFIX}-hidden-line { display: none; }
.${PREFIX}-hidden-line.${PREFIX}-hidden-open { display: grid; }
.${PREFIX}-hidden-line.${PREFIX}-hidden-open .code {
  background: color-mix(in srgb, ${cssVar('codeForeground')} 4%, transparent);
}
.${PREFIX}-hidden-marker {
  display: flex;
  align-items: center;
  width: 100%;
  height: 1.5em;
  margin: 1px 0;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  font: inherit;
  color: ${cssVar('codeblocks.mutedForeground')};
  text-align: left;
}
.${PREFIX}-hidden-marker::after {
  content: '';
  flex: 1;
  margin-inline-start: 0.75rem;
  border-top: 1px dashed ${cssVar('codeblocks.mutedForeground')};
}
.${PREFIX}-hidden-marker:hover, .${PREFIX}-hidden-marker:focus-visible {
  color: ${cssVar('codeForeground')};
}
.${PREFIX}-hidden-toggle {
  margin-inline-start: auto;
}
/* Without a title or a terminal frame, the header is collapsed (display: none). A hidden-lines
   block still needs it for the toggle button, so give it a minimal bar of its own. */
.frame:not(.has-title):not(.is-terminal):has(.${PREFIX}-hidden-toggle) {
  --button-spacing: 2.1rem;
}
.frame:not(.has-title):not(.is-terminal):has(.${PREFIX}-hidden-toggle) .header {
  display: flex;
  align-items: center;
  min-height: 1.9rem;
  padding-inline: ${cssVar('uiPaddingInline')};
  background: color-mix(in srgb, ${cssVar('codeForeground')} 5%, ${cssVar('codeBackground')});
  border-bottom: ${cssVar('borderWidth')} solid ${cssVar('borderColor')};
}
@media print {
  .${PREFIX}-hidden-line { display: none !important; }
}`,
    jsModules: clientJsModules,
    hooks: {
      preprocessMetadata(context) {
        const { lines } = hiddenData.getOrCreateFor(context.codeBlock);
        for (const line of resolveRange(context, 'hidden') ?? []) lines.add(line);
        for (const directive of getDirectives(context.codeBlock, 'code hide')) {
          for (const line of directive.lines) lines.add(line);
        }
      },
      postprocessRenderedBlock({ codeBlock, renderData }) {
        const { lines: hidden } = hiddenData.getOrCreateFor(codeBlock);
        if (hidden.size === 0) return;
        const code = select('pre > code', renderData.blockAst);
        const figure = select('figure', renderData.blockAst);
        if (!code || !figure) return;
        const lineEls = selectAll('.ec-line', code);
        const lines = codeBlock.getLines();
        const uid = Math.random().toString(36).slice(2, 8);
        const children: ElementContent[] = [];
        const markerIds: string[] = [];
        let run = 0;
        for (let i = 0; i < lineEls.length; i++) {
          const isHidden = hidden.has(lines[i] as ExpressiveCodeLine);
          const wasHidden = i > 0 && hidden.has(lines[i - 1] as ExpressiveCodeLine);
          if (isHidden && !wasHidden) {
            run++;
            const ids: string[] = [];
            for (let k = i; k < lineEls.length && hidden.has(lines[k] as ExpressiveCodeLine); k++) {
              const id = `${PREFIX}-hidden-${uid}-l${k}`;
              lineEls[k].properties.id = id;
              ids.push(id);
            }
            const markerId = `${PREFIX}-hidden-${uid}-m${run}`;
            markerIds.push(markerId);
            children.push(
              h(
                'button',
                {
                  type: 'button',
                  id: markerId,
                  class: `${PREFIX}-hidden-marker`,
                  ariaExpanded: 'false',
                  ariaControls: ids.join(' '),
                },
                [h('span', {}, plural(ids.length))],
              ),
            );
          }
          if (isHidden) addClassName(lineEls[i], `${PREFIX}-hidden-line`);
          children.push(lineEls[i]);
        }
        code.children = children;
        figure.properties.dataScbHiddenLines = '';
        const header = select('.header', figure);
        if (header) {
          header.children.push(
            h(
              'button',
              {
                type: 'button',
                class: `${PREFIX}-btn ${PREFIX}-hidden-toggle`,
                ariaPressed: 'false',
                ariaControls: markerIds.join(' '),
              },
              `Show ${plural(hidden.size)}`,
            ),
          );
        }
      },
    },
  };
}
