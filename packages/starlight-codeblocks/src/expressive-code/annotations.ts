import { PluginStyleSettings, type UnresolvedStyleValue } from '@expressive-code/core';
import { h, select, selectAll } from '@expressive-code/core/hast';
import { clientJsModules } from '../client-modules.ts';
import type { CodeblocksPlugin } from './core.ts';
import { inlineMarkdown } from './inline-markdown.ts';
import { getDirectives } from './notation.ts';
import { PREFIX } from './styles.ts';

export interface AnnotationsStyleSettings {
  markerBackground: UnresolvedStyleValue;
  markerForeground: UnresolvedStyleValue;
  markerSize: UnresolvedStyleValue;
}

declare module '@expressive-code/core' {
  export interface StyleSettings {
    codeblocksAnnotations: AnnotationsStyleSettings;
  }
}

const styleSettings = new PluginStyleSettings({
  defaultValues: {
    codeblocksAnnotations: {
      markerBackground: ({ resolveSetting }) => resolveSetting('codeblocks.accent'),
      markerForeground: ({ resolveSetting }) => resolveSetting('codeblocks.accentForeground'),
      markerSize: '1.55em',
    },
  },
});

const cls = (suffix = '') => `${PREFIX}-annotation${suffix}`;

/** Turns `[!annotate] text` into a numbered button after the code that opens the text in a popover. */
export function pluginAnnotations(): CodeblocksPlugin {
  return {
    name: 'starlight-codeblocks:annotations',
    directives: {
      annotate: {
        placement: 'end',
        text: true,
        docs: {
          description: 'Adds a numbered marker after the code. Selecting it opens the text in a popover.',
          example: 'with path.open() as fh:  # [!annotate] Closes the file when the block ends.',
          page: 'features/annotations',
        },
      },
    },
    styleSettings,
    baseStyles: ({ cssVar }) => `
.${cls()} {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: ${cssVar('codeblocksAnnotations.markerSize')};
  height: ${cssVar('codeblocksAnnotations.markerSize')};
  margin-inline-start: 1.6ch;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: ${cssVar('codeblocksAnnotations.markerBackground')};
  color: ${cssVar('codeblocksAnnotations.markerForeground')};
  font: 600 0.8em/1 ${cssVar('codeFontFamily')};
  vertical-align: 0.1em;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  transition: background-color 150ms ease;
}
.${cls()}:hover, .${cls()}:focus-visible, .${cls()}:has(+ :popover-open) {
  background: color-mix(in srgb, ${cssVar('codeblocksAnnotations.markerBackground')} 70%, ${cssVar('codeForeground')});
}
.${cls('-popover')} { padding: 0.6rem 0.8rem; font-size: 0.875rem; }
.${cls('-popover')} p { margin: 0; }
.${cls('-popover')} code {
  padding: 0 4px;
  border-radius: 3px;
  background: color-mix(in srgb, currentColor 12%, transparent);
  font-size: 0.95em;
}
.${cls('-popover')} a { color: inherit; text-underline-offset: 3px; }
.${cls('-list')} { display: none; }
@media print {
  .${cls('-list')} {
    display: block;
    margin: 0;
    padding: 0.6rem 1rem 0.75rem 2.5rem;
    border-top: ${cssVar('borderWidth')} solid ${cssVar('borderColor')};
    font-size: 0.85em;
  }
  .${cls()}, .${cls('-popover')} { display: none !important; }
}`,
    jsModules: clientJsModules,
    hooks: {
      postprocessRenderedBlock({ codeBlock, renderData }) {
        const annotations = getDirectives(codeBlock, 'annotate');
        const figure = select('figure', renderData.blockAst);
        const pre = figure && select('pre', figure);
        if (annotations.length === 0 || !figure || !pre) return;
        const lines = codeBlock.getLines();
        const lineEls = selectAll('.ec-line', pre);
        const ordered = annotations
          .map((directive) => ({ directive, index: lines.indexOf(directive.lines[0] as never) }))
          .filter(({ index }) => index >= 0)
          .sort((a, b) => a.index - b.index);
        const uid = Math.random().toString(36).slice(2, 8);
        const items = ordered.map(({ directive, index }, i) => {
          const n = i + 1;
          const id = `${PREFIX}-annotation-${uid}-${n}`;
          const anchor = `--${id}`;
          const code = lineEls[index] && select('.code', lineEls[index]);
          code?.children.push(
            h(
              'button',
              {
                type: 'button',
                class: cls(),
                popovertarget: id,
                ariaLabel: `Annotation ${n}`,
                style: `anchor-name:${anchor}`,
              },
              String(n),
            ),
            h(
              'div',
              { id, popover: 'auto', class: `${PREFIX}-float ${cls('-popover')}`, style: `position-anchor:${anchor}` },
              [h('p', inlineMarkdown(directive.text ?? ''))],
            ),
          );
          return h('li', inlineMarkdown(directive.text ?? ''));
        });
        figure.properties.dataScbAnnotations = '';
        figure.children.splice(figure.children.indexOf(pre) + 1, 0, h('ol', { class: cls('-list') }, items));
      },
    },
  };
}
