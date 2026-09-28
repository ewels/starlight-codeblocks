import {
  type ExpressiveCodeBlock,
  type ExpressiveCodeLine,
  ensureColorContrastOnBackground,
  getCssVarName,
  PluginStyleSettings,
  type StyleResolverFn,
  setAlpha,
  type UnresolvedStyleValue,
} from '@expressive-code/core';
import { type Element, getClassNames, h, select } from '@expressive-code/core/hast';
import { clientJsModules } from '../client-modules.ts';
import { type CodeblocksPlugin, lineNumber, numberedLines } from './core.ts';
import { litLine, onCode, PREFIX, solidCodeBackground, themeColour } from './styles.ts';

export interface PermalinksStyleSettings {
  foreground: UnresolvedStyleValue;
  target: UnresolvedStyleValue;
  targetBackground: UnresolvedStyleValue;
}

declare module '@expressive-code/core' {
  export interface StyleSettings {
    codeblocksPermalinks: PermalinksStyleSettings;
  }
}

type Context = Parameters<StyleResolverFn>[0];

const styleSettings = new PluginStyleSettings({
  defaultValues: {
    codeblocksPermalinks: {
      // Line numbers are links, so they need text contrast, more than Expressive Code gives its gutter.
      foreground: (context: Context) =>
        ensureColorContrastOnBackground(
          context.resolveSetting('gutterForeground'),
          solidCodeBackground(context),
          4.5,
          5,
        ),
      target: (context: Context) => onCode(context, themeColour(context, 'terminal.ansiYellow'), 3),
      // Any line can be the target, so the tint must stay light enough for every syntax colour as it is.
      targetBackground: ({ resolveSetting, theme }: Context) =>
        setAlpha(resolveSetting('codeblocksPermalinks.target'), theme.type === 'dark' ? 0.06 : 0.12),
    },
  },
});

const LINK = `${PREFIX}-permalink`;

const hasClass = (el: Element, name: string) => getClassNames(el).includes(name);

/** The block's `id` and its line numbers, from `startLineNumber`, or `undefined` for a block with no `id`. */
function numbering(codeBlock: ExpressiveCodeBlock) {
  const id = codeBlock.metaOptions.getString('id');
  if (!id) return undefined;
  const of = (line: ExpressiveCodeLine) => lineNumber(codeBlock, line);
  return { id, last: of(numberedLines(codeBlock).at(-1) as ExpressiveCodeLine), of };
}

/** Turns the line numbers of a block with `id="…"` into links to `#<id>-L<n>`. */
export function pluginPermalinks(): CodeblocksPlugin {
  return {
    name: 'starlight-codeblocks:permalinks',
    styleSettings,
    baseStyles: ({ cssVar }) => `
[data-scb-permalinks] { ${getCssVarName('gutterBorderColor')}: transparent; }
.ec-line .gutter > .${LINK} {
  display: block;
  box-sizing: border-box;
  width: var(--scb-gutter);
  padding-inline: 2ch;
  text-align: end;
  color: ${cssVar('codeblocksPermalinks.foreground')};
  text-decoration: none;
  pointer-events: auto;
}
/* Inset, because the pre clips a ring outside the gutter. */
.ec-line .gutter > a.${LINK}:focus-visible { outline-offset: -2px; }
.ec-line .gutter > a.${LINK}:hover {
  color: ${cssVar('codeForeground')};
  text-decoration: underline;
}
${litLine(`.${LINK}-target`, cssVar('codeblocksPermalinks.targetBackground'), cssVar('codeblocksPermalinks.target'))}`,
    jsModules: clientJsModules,
    hooks: {
      preprocessMetadata({ codeBlock, addGutterElement }) {
        const numbers = numbering(codeBlock);
        if (!numbers) return;
        addGutterElement({
          renderPhase: 'earlier',
          renderLine({ line }) {
            const n = numbers.of(line);
            return h('a', { class: LINK, href: `#${numbers.id}-L${n}`, ariaLabel: `Link to line ${n}` }, String(n));
          },
          renderPlaceholder: () => h('span', { class: LINK }),
        });
      },
      postprocessRenderedLine({ codeBlock, line, renderData }) {
        const numbers = numbering(codeBlock);
        if (!numbers) return;
        renderData.lineAst.properties.id = `${numbers.id}-L${numbers.of(line)}`;
        // The line numbers plugin would show a second number next to the link.
        const gutter = select('.gutter', renderData.lineAst);
        if (gutter) gutter.children = gutter.children.filter((c) => !(c.type === 'element' && hasClass(c, 'ln')));
      },
      postprocessRenderedBlock({ codeBlock, renderData }) {
        const numbers = numbering(codeBlock);
        if (!numbers) return;
        const digits = String(numbers.last).length;
        const figure = select('figure', renderData.blockAst) ?? renderData.blockAst;
        figure.properties.id = numbers.id;
        figure.properties.dataScbPermalinks = '';
        // Hidden-line markers and callouts read this width to line up with the code.
        const style = String(figure.properties.style ?? '');
        figure.properties.style = `${style}${style ? ';' : ''}--scb-gutter:${Math.max(2, digits) + 4}ch`;
      },
    },
  };
}
