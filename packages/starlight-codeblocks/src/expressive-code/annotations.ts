import {
  type ExpressiveCodeLine,
  PluginStyleSettings,
  setAlpha,
  type UnresolvedStyleValue,
} from '@expressive-code/core';
import { h, select } from '@expressive-code/core/hast';
import { clientJsModules } from '../client-modules.ts';
import { blockUid, type CodeblocksPlugin, lineElement, warn } from './core.ts';
import { inlineMarkdown } from './inline-markdown.ts';
import { getRenderedDirectives } from './notation.ts';
import { hoverColour, PREFIX } from './styles.ts';

export interface AnnotationsStyleSettings {
  markerBackground: UnresolvedStyleValue;
  markerForeground: UnresolvedStyleValue;
  markerHoverBackground: UnresolvedStyleValue;
  markerSize: UnresolvedStyleValue;
  lineBackground: UnresolvedStyleValue;
}

declare module '@expressive-code/core' {
  export interface StyleSettings {
    codeblocksAnnotations: AnnotationsStyleSettings;
  }
}

/** Container widths, in px, at which a side-by-side block can become two columns. */
export const SIDE_SIZES = [600, 800, 1000];

/**
 * The smallest size whose code column shows `chars` characters without scrolling: 8.4 px per character
 * at Starlight's 14 px code font, 34 px of frame padding, and `reserve` px for the gap and the other column.
 * Longer lines get the largest size and scroll.
 */
export function sideSize(chars: number, reserve = 210) {
  const need = 34 + reserve + chars * 8.4;
  return SIDE_SIZES.find((w) => w >= need) ?? SIDE_SIZES[SIDE_SIZES.length - 1];
}

/**
 * Blocks too wide for Starlight's content column, placed straight in a page without a table of contents.
 * They spread over the free space on both sides of the column; the grid keeps to the column until
 * the columns fit. It must start with `:root` and not name `.expressive-code`, or Expressive Code
 * scopes it inside the block.
 */
const BREAKOUT = `:root:not([data-has-toc]) .sl-markdown-content > * > :is(${SIDE_SIZES.slice(1)
  .map((w) => `.${PREFIX}-side-${w}`)
  .join(', ')})`;

const styleSettings = new PluginStyleSettings({
  defaultValues: {
    codeblocksAnnotations: {
      markerBackground: ({ resolveSetting }) => resolveSetting('codeblocks.accent'),
      markerForeground: ({ resolveSetting }) => resolveSetting('codeblocks.accentForeground'),
      markerHoverBackground: (context) =>
        hoverColour(context.resolveSetting('codeblocksAnnotations.markerBackground'), context),
      markerSize: '1.55em',
      // Light enough for every syntax colour as it is, so that a line keeps its colours when it lights up.
      lineBackground: ({ resolveSetting, theme }) =>
        setAlpha(resolveSetting('codeblocks.accent'), theme.type === 'dark' ? 0.1 : 0.12),
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
  /* Forced colours remove the background, but draw the border. */
  border: 1px solid transparent;
  border-radius: 50%;
  background: ${cssVar('codeblocksAnnotations.markerBackground')};
  color: ${cssVar('codeblocksAnnotations.markerForeground')};
  font: 600 0.8em/1 ${cssVar('codeFontFamily')};
  vertical-align: 0.1em;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
}
.${cls()}:hover, .${cls()}:focus-visible, .${cls()}:has(+ :popover-open) {
  background: ${cssVar('codeblocksAnnotations.markerHoverBackground')};
}
/* On the timing of the hover note: it waits 80 ms, then grows for 160 ms. */
@media (prefers-reduced-motion: no-preference) {
  button.${cls()} { transition: background-color 160ms ease-out; }
  button.${cls()}:hover { transition-delay: 80ms; }
}
.${cls('-popover')} {
  gap: 0.5rem;
  padding: 0.45rem 0.8rem 0.45rem 0.5rem;
  font-size: 0.875rem;
}
.${cls('-popover')}:popover-open { display: flex; align-items: flex-start; }
.${cls('-popover')} p { min-width: 0; margin: 0; }
/* The same circle as the open marker, centred on the first line of text (0.875rem × line-height 1.5). */
.${cls('-badge')} {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: ${cssVar('codeblocksAnnotations.markerSize')};
  height: ${cssVar('codeblocksAnnotations.markerSize')};
  margin-block: calc((1.3125rem - ${cssVar('codeblocksAnnotations.markerSize')}) / 2);
  border: 1px solid transparent;
  border-radius: 50%;
  background: ${cssVar('codeblocksAnnotations.markerHoverBackground')};
  color: ${cssVar('codeblocksAnnotations.markerForeground')};
  font: 600 calc(0.8 * ${cssVar('codeFontSize')})/1 ${cssVar('codeFontFamily')};
  user-select: none;
  -webkit-user-select: none;
}
/* Set by the script when the box fits beside the marker: the badge covers the marker. Keep in step with the padding above. */
.${cls('-end')} {
  width: max-content;
  max-width: min(${cssVar('codeblocks.popoverMaxWidth')}, calc(100vw - 24px));
  margin: 0;
  position-area: none;
  justify-self: auto;
  position-try-fallbacks: none;
  left: calc(anchor(left) - 1px - 0.5rem);
  top: calc(anchor(center) - 1px - 0.45rem - 1.3125rem / 2);
}
/* The whole note fades, in and out, on the timing of the marker colour. */
.${cls('-popover')} {
  opacity: 0;
  transition: opacity 160ms ease-out, display 160ms allow-discrete, overlay 160ms allow-discrete;
}
.${cls('-popover')}:popover-open { opacity: 1; }
@starting-style {
  .${cls('-popover')}:popover-open { opacity: 0; }
}
/* Until the script has placed the note, so that the fade starts where the note stays. */
.${cls('-popover')}.${cls('-wait')} { opacity: 0; }
/* The badge covers the marker and acts as it, and a click in a hover note keeps it. */
.${cls('-badge')}, .${cls('-popover')}[data-scb-peek] { cursor: pointer; }
/* .frame outweighs Expressive Code's square top corners for code in titled blocks. */
.frame .${cls('-popover')} code {
  padding: 0 4px;
  border-radius: 3px;
  background: color-mix(in srgb, currentColor 12%, transparent);
  font-family: ${cssVar('codeFontFamily')};
  font-size: 0.95em;
}
.${cls('-popover')} a { color: inherit; text-underline-offset: 3px; }
.${cls('-num')} { cursor: default; }
.ec-line.${cls('-lit')} { background: ${cssVar('codeblocksAnnotations.lineBackground')}; }
.ec-line.${cls('-lit')} .code { --ecLineBrdCol: ${cssVar('codeblocks.accent')}; --ecGtrBrdWd: 3px; }
.${PREFIX}-side { container-type: inline-size; }
.${PREFIX}-side-grid { margin-inline: var(--${PREFIX}-side-outset, 0px); }
@media (min-width: 72rem) {
  ${BREAKOUT} {
    --${PREFIX}-side-outset: max(0px, (100vw - 2 * var(--sl-content-pad-x) - var(--sl-content-width)) / 2);
    margin-inline: calc(-1 * var(--${PREFIX}-side-outset));
  }
  :root[data-has-sidebar]${BREAKOUT.slice(':root'.length)} {
    --${PREFIX}-side-outset: max(
      0px,
      (100vw - var(--sl-sidebar-width) - 2 * var(--sl-content-pad-x) - var(--sl-content-width)) / 2
    );
  }
}
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
}
.${cls('-notes')} li:focus-visible {
  outline: 2px solid ${cssVar('codeblocks.focusRing')};
  outline-offset: 2px;
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
${SIDE_SIZES.map(
  (w) => `@container (min-width: ${w}px) {
  .${PREFIX}-side-${w} > .${PREFIX}-side-grid {
    margin-inline: max(0px, min(var(--${PREFIX}-side-outset, 0px), (100% - ${w}px) / 2));
    display: grid;
    grid-template-columns: minmax(0, auto) minmax(12rem, 1fr);
    gap: 18px;
    align-items: start;
  }
  .${PREFIX}-side-${w} .${cls('-notes')} {
    position: sticky;
    top: calc(var(--sl-nav-height, 0px) + var(--sl-mobile-toc-height, 0px) + 1rem);
    margin: 0;
  }
}`,
).join('\n')}
.${PREFIX}-side-code-right > .${PREFIX}-side-grid { grid-template-columns: minmax(12rem, 1fr) minmax(0, auto); }
.${PREFIX}-side-code-right .${cls('-notes')} { order: -1; }
.${PREFIX}-side-static .${cls('-notes')} { position: static; }
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
        const annotations = getRenderedDirectives(context, 'annotate');
        const figure = select('figure', renderData.blockAst);
        const pre = figure && select('pre', figure);
        if (annotations.length === 0 || !figure || !pre) return;
        const mode = codeBlock.metaOptions.getString('annotations');
        if (mode !== undefined && mode !== 'side') {
          warn(context, `\`annotations="${mode}"\` must be \`"side"\`. The plugin ignores it.`);
        }
        const side = mode === 'side';
        const codeSide = codeBlock.metaOptions.getString('codeSide');
        if (codeSide !== undefined && (!side || !['left', 'right'].includes(codeSide))) {
          warn(
            context,
            `\`codeSide="${codeSide}"\` needs \`annotations="side"\` and must be \`"left"\` or \`"right"\`. The plugin ignores it.`,
          );
        }
        const lines = codeBlock.getLines();
        const ordered = annotations
          .map((directive) => ({ directive, index: lines.indexOf(directive.lines[0] as never) }))
          .sort((a, b) => a.index - b.index);
        const uid = blockUid(context);
        const items = ordered.map(({ directive }, i) => {
          const n = String(i + 1);
          const text = inlineMarkdown(directive.text ?? '');
          const lineEl = lineElement(directive.lines[0] as ExpressiveCodeLine);
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
              {
                id,
                popover: 'manual',
                class: `${PREFIX}-float ${cls('-popover')}`,
                style: `position-anchor:${anchor}`,
              },
              [h('span', { class: cls('-badge'), ariaHidden: 'true' }, n), h('p', text)],
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
        // A number takes about 3 characters, and the copy button pads the first line by about 4.
        const numbered = new Set(ordered.map(({ directive }) => directive.lines[0]));
        const size = sideSize(
          Math.max(...lines.map((line, i) => line.text.length + (numbered.has(line) ? 3 : 0) + (i === 0 ? 4 : 0))),
        );
        renderData.blockAst = h(
          'div',
          {
            class: `${PREFIX}-side ${PREFIX}-side-${size}${codeSide === 'right' ? ` ${PREFIX}-side-code-right` : ''} not-content`,
            dataScbAnnotations: '',
          },
          [h('div', { class: `${PREFIX}-side-grid` }, [renderData.blockAst, notes])],
        );
      },
    },
  };
}
