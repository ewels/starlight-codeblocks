import {
  ensureColorContrastOnBackground,
  getCssVarName,
  PluginStyleSettings,
  type StyleResolverFn,
  setAlpha,
  type UnresolvedStyleValue,
} from '@expressive-code/core';
import { type Element, getClassNames, h, select } from '@expressive-code/core/hast';
import { clientJsModules } from '../client-modules.ts';
import { type CodeblocksPlugin, numberedLines } from './core.ts';
import { PREFIX } from './styles.ts';

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
      foreground: ({ resolveSetting }: Context) =>
        ensureColorContrastOnBackground(resolveSetting('gutterForeground'), resolveSetting('codeBackground'), 4.5, 5),
      target: ['#ffcb8b', '#a15c00'],
      targetBackground: ({ resolveSetting }: Context) => setAlpha(resolveSetting('codeblocksPermalinks.target'), 0.16),
    },
  },
});

const LINK = `${PREFIX}-permalink`;

const hasClass = (el: Element, name: string) => getClassNames(el).includes(name);

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
  text-align: end;
  color: ${cssVar('codeblocksPermalinks.foreground')};
  text-decoration: none;
  pointer-events: auto;
}
.ec-line .gutter > a.${LINK}:focus-visible { outline-offset: -2px; }
.ec-line .gutter > a.${LINK}:hover {
  color: ${cssVar('codeForeground')};
  text-decoration: underline;
}
.${LINK}-target {
  background: ${cssVar('codeblocksPermalinks.targetBackground')};
  box-shadow: inset 3px 0 ${cssVar('codeblocksPermalinks.target')};
}`,
    jsModules: clientJsModules,
    hooks: {
      preprocessMetadata({ codeBlock, addGutterElement }) {
        const id = codeBlock.metaOptions.getString('id');
        if (!id) return;
        const start = codeBlock.metaOptions.getInteger('startLineNumber') ?? 1;
        const lines = numberedLines(codeBlock);
        addGutterElement({
          renderPhase: 'earlier',
          renderLine({ line }) {
            const n = lines.indexOf(line) + start;
            return h('a', { class: LINK, href: `#${id}-L${n}`, ariaLabel: `Link to line ${n}` }, String(n));
          },
          renderPlaceholder: () => h('span', { class: LINK }),
        });
      },
      postprocessRenderedLine({ codeBlock, line, renderData }) {
        const id = codeBlock.metaOptions.getString('id');
        if (!id) return;
        const start = codeBlock.metaOptions.getInteger('startLineNumber') ?? 1;
        renderData.lineAst.properties.id = `${id}-L${numberedLines(codeBlock).indexOf(line) + start}`;
        // The line numbers plugin would show a second number next to the link.
        const gutter = select('.gutter', renderData.lineAst);
        if (gutter) gutter.children = gutter.children.filter((c) => !(c.type === 'element' && hasClass(c, 'ln')));
      },
      postprocessRenderedBlock({ codeBlock, renderData }) {
        const id = codeBlock.metaOptions.getString('id');
        if (!id) return;
        const start = codeBlock.metaOptions.getInteger('startLineNumber') ?? 1;
        const digits = String(start + numberedLines(codeBlock).length - 1).length;
        const figure = select('figure', renderData.blockAst) ?? renderData.blockAst;
        figure.properties.id = id;
        figure.properties.dataScbPermalinks = '';
        // Hidden-line markers and callouts read this width to line up with the code.
        const style = String(figure.properties.style ?? '');
        figure.properties.style = `${style}${style ? ';' : ''}--scb-gutter:${Math.max(2, digits) + 2.2}ch`;
      },
    },
  };
}
