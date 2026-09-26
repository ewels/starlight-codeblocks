import { PluginStyleSettings, type UnresolvedStyleValue } from '@expressive-code/core';
import { h, select, selectAll } from '@expressive-code/core/hast';
import { clientJsModules } from '../client-modules.ts';
import { blockUid, type CodeblocksPlugin, warn } from './core.ts';
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
          args: 'The text of the annotation.',
          example: { lang: 'js', code: 'const port = 8080 // [!annotate] The default port.' },
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
.${cls('-num')} { cursor: default; }
.${cls('-num')}:hover { background: ${cssVar('codeblocksAnnotations.markerBackground')}; }
.ec-line.${cls('-lit')} { background: color-mix(in srgb, ${cssVar('codeblocks.accent')} 17%, transparent); }
.ec-line.${cls('-lit')} .code { --ecLineBrdCol: ${cssVar('codeblocks.accent')}; --ecGtrBrdWd: 3px; }
.${PREFIX}-side { container-type: inline-size; }
.${cls('-notes')} {
  margin: 0.75rem 0 0;
  padding: 0;
  list-style: none;
  font-family: ${cssVar('uiFontFamily')};
  font-size: 0.9375rem;
  line-height: 1.45;
}
.${cls('-notes')} li {
  margin: 0 0 0.625rem;
  padding: 3px 0 3px 12px;
  border-inline-start: 2px solid ${cssVar('borderColor')};
  transition: border-color 150ms ease;
}
.${cls('-notes')} li.${cls('-on')}, .${cls('-notes')} li:focus-visible {
  border-color: ${cssVar('codeblocks.accent')};
  outline: none;
}
.${cls('-note-num')} {
  margin-inline-end: 5px;
  color: ${cssVar('codeblocks.accent')};
  font: 600 0.75rem ${cssVar('codeFontFamily')};
}
.${cls('-notes')} code {
  padding: 0 4px;
  border-radius: 3px;
  background: color-mix(in srgb, currentColor 12%, transparent);
  font-size: 0.9em;
}
@container (min-width: 600px) {
  .${PREFIX}-side-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.65fr) minmax(190px, 1fr);
    gap: 18px;
    align-items: start;
  }
  .${cls('-notes')} {
    position: sticky;
    top: calc(var(--sl-nav-height, 0px) + var(--sl-mobile-toc-height, 0px) + 1rem);
    margin: 0;
  }
  .${PREFIX}-side-static .${cls('-notes')} { position: static; }
}
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
      postprocessRenderedBlock(context) {
        const { codeBlock, renderData } = context;
        const annotations = getDirectives(codeBlock, 'annotate');
        const figure = select('figure', renderData.blockAst);
        const pre = figure && select('pre', figure);
        if (annotations.length === 0 || !figure || !pre) return;
        const mode = codeBlock.metaOptions.getString('annotations');
        if (mode !== undefined && mode !== 'side') {
          warn(context, `\`annotations="${mode}"\` must be \`"side"\`. The plugin ignores it.`);
        }
        const side = mode === 'side';
        const lines = codeBlock.getLines();
        const lineEls = selectAll('.ec-line', pre);
        const ordered = annotations
          .map((directive) => ({ directive, index: lines.indexOf(directive.lines[0] as never) }))
          .filter(({ index }) => index >= 0)
          .sort((a, b) => a.index - b.index);
        const uid = blockUid(context);
        const items = ordered.map(({ directive, index }, i) => {
          const n = String(i + 1);
          const text = inlineMarkdown(directive.text ?? '');
          const lineEl = lineEls[index];
          const code = lineEl && select('.code', lineEl);
          if (side) {
            if (lineEl) lineEl.properties.dataScbAnno = n;
            code?.children.push(h('span', { class: `${cls()} ${cls('-num')}`, ariaHidden: 'true' }, n));
            return h('li', { tabindex: '0', dataScbAnno: n }, [h('span', { class: cls('-note-num') }, n), ...text]);
          }
          const id = `${PREFIX}-annotation-${uid}-${n}`;
          const anchor = `--${id}`;
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
              n,
            ),
            h(
              'div',
              { id, popover: 'auto', class: `${PREFIX}-float ${cls('-popover')}`, style: `position-anchor:${anchor}` },
              [h('p', text)],
            ),
          );
          return h('li', inlineMarkdown(directive.text ?? ''));
        });
        if (!side) {
          figure.properties.dataScbAnnotations = '';
          figure.children.splice(figure.children.indexOf(pre) + 1, 0, h('ol', { class: cls('-list') }, items));
          return;
        }
        // The notes sit outside the frame, so the block becomes a two-column grid when its container is wide.
        const notes = h('ol', { class: cls('-notes') }, items);
        renderData.blockAst = h('div', { class: `${PREFIX}-side not-content`, dataScbAnnotations: '' }, [
          h('div', { class: `${PREFIX}-side-grid` }, [renderData.blockAst, notes]),
        ]);
      },
    },
  };
}
