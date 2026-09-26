import {
  type ExpressiveCodeLine,
  onBackground,
  PluginStyleSettings,
  type StyleResolverFn,
  setAlpha,
  type UnresolvedStyleValue,
} from '@expressive-code/core';
import { addClassName, h, select } from '@expressive-code/core/hast';
import { clientJsModules } from '../client-modules.ts';
import { blockUid, type CodeblocksPlugin, lineElement, numberedLines, warn } from './core.ts';
import { inlineMarkdown } from './inline-markdown.ts';
import { getDirectives } from './notation.ts';
import { PREFIX } from './styles.ts';

export interface FootnotesStyleSettings {
  /** The badge border, the bar of a selected line and the badge background when selected. */
  accent: UnresolvedStyleValue;
  /** Badge numbers and list numbers. Needs 4.5:1 on the code background. */
  numberForeground: UnresolvedStyleValue;
  /** The badge number on an `accent` background. */
  activeForeground: UnresolvedStyleValue;
  lineBackground: UnresolvedStyleValue;
  stickyShadow: UnresolvedStyleValue;
}

declare module '@expressive-code/core' {
  export interface StyleSettings {
    codeblocksFootnotes: FootnotesStyleSettings;
  }
}

const styleSettings = new PluginStyleSettings({
  defaultValues: {
    codeblocksFootnotes: {
      accent: ['#c792ea', '#8a3fc7'],
      numberForeground: ['#d8b3f3', '#7a2fb5'],
      activeForeground: ['#1b1f2c', '#ffffff'],
      // Light enough for every syntax colour as it is, so that a line keeps its colours when it lights up.
      lineBackground: ({ resolveSetting, theme }: Parameters<StyleResolverFn>[0]) =>
        onBackground(
          setAlpha(resolveSetting('codeblocksFootnotes.accent'), theme.type === 'dark' ? 0.1 : 0.12),
          resolveSetting('codeBackground'),
        ),
      stickyShadow: ['0 -8px 16px rgb(10 14 24 / 0.35)', '0 -6px 14px rgb(12 20 36 / 0.1)'],
    },
  },
});

const cls = (suffix = '') => `${PREFIX}-footnote${suffix}`;

/** Turns `[!ref] text` above a line into a numbered badge on the line and an item in a list under the block. */
export function pluginFootnotes({ sticky: siteSticky = false }: { sticky?: boolean } = {}): CodeblocksPlugin {
  return {
    name: 'starlight-codeblocks:footnotes',
    directives: {
      ref: {
        placement: 'own',
        text: true,
        docs: {
          description: 'Adds a numbered badge to the next line, and the text to a list under the block.',
          args: 'The text of the footnote.',
          example: { lang: 'js', code: '// [!ref] Read from the environment.\nconst port = process.env.PORT' },
          page: 'features/footnotes',
        },
      },
    },
    styleSettings,
    baseStyles: ({ cssVar }) => {
      const v = (key: string) => cssVar(`codeblocksFootnotes.${key}` as never);
      return `
.frame:has(> .${cls('s')}) > pre { border-end-start-radius: 0; border-end-end-radius: 0; }
.${cls('-badge')} {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-width: 1.55em;
  height: 1.55em;
  margin-inline-start: 1.6ch;
  padding: 0 0.3em;
  border: 1px solid ${v('accent')};
  border-radius: 999px;
  color: ${v('numberForeground')};
  font: 600 0.8em/1 ${cssVar('codeFontFamily')};
  text-decoration: none;
  vertical-align: 0.1em;
  user-select: none;
  -webkit-user-select: none;
  scroll-margin-block: 5rem;
  transition: background-color 150ms ease, color 150ms ease;
}
.${cls('-badge')}:hover { background: color-mix(in srgb, ${v('accent')} 18%, transparent); }
.ec-line.${cls('-on')} { background: ${v('lineBackground')}; }
.ec-line.${cls('-on')} .code { --ecLineBrdCol: ${v('accent')}; --ecGtrBrdWd: 3px; }
.ec-line.${cls('-on')} .${cls('-badge')} { background: ${v('accent')}; color: ${v('activeForeground')}; }
.${cls('s')} {
  margin: 0;
  padding: 0.6rem 1.1rem 0.75rem;
  list-style: none;
  border: ${cssVar('borderWidth')} solid ${cssVar('borderColor')};
  border-top: 0;
  border-radius: 0 0 ${cssVar('borderRadius')} ${cssVar('borderRadius')};
  background: ${cssVar('codeBackground')};
  color: ${cssVar('codeblocks.mutedForeground')};
  font-family: ${cssVar('codeFontFamily')};
  font-size: 0.8125rem;
  line-height: 1.55;
}
.${cls('s')} li {
  display: flex;
  align-items: baseline;
  gap: 0.6ch;
  margin: 0;
  padding: 1px 0;
  cursor: pointer;
  scroll-margin-block: 5rem;
}
.${cls('s')} li.${cls('-on')} { color: ${cssVar('codeForeground')}; }
.${cls('-num')} {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  min-width: max(2.5ch, 24px);
  min-height: 24px;
  color: ${v('numberForeground')};
  font-weight: 600;
  text-align: end;
  text-decoration: none;
}
.${cls('-num')}:hover { text-decoration: underline; text-underline-offset: 3px; }
.${cls('s')} code {
  padding: 0 4px;
  color: ${cssVar('codeForeground')};
  border-radius: 3px;
  background: color-mix(in srgb, currentColor 12%, transparent);
  font-size: 0.95em;
}
.${cls('s')} a:not(.${cls('-num')}) { color: inherit; text-underline-offset: 3px; }
.${cls('s-sticky')} .${cls('s')} {
  position: sticky;
  bottom: 0;
  z-index: 2;
  background: color-mix(in srgb, ${cssVar('codeForeground')} 5%, ${cssVar('codeBackground')});
  box-shadow: ${v('stickyShadow')};
}`;
    },
    jsModules: clientJsModules,
    hooks: {
      postprocessRenderedBlock(context) {
        const { codeBlock, renderData } = context;
        const refs = getDirectives(codeBlock, 'ref');
        const figure = select('figure', renderData.blockAst);
        const pre = figure && select('pre', figure);
        if (refs.length === 0 || !figure || !pre) return;
        const attribute = codeBlock.metaOptions.getString('footnotes');
        if (attribute !== undefined && attribute !== 'sticky' && attribute !== 'static') {
          warn(context, `\`footnotes="${attribute}"\` must be \`"sticky"\` or \`"static"\`. The plugin ignores it.`);
        }
        const sticky = attribute === 'sticky' || (attribute !== 'static' && siteSticky);
        const lines = codeBlock.getLines();
        const ordered = refs
          .map((directive) => ({ directive, index: lines.indexOf(directive.lines[0] as never) }))
          .filter(({ index }) => index >= 0)
          .sort((a, b) => a.index - b.index);
        const start = codeBlock.metaOptions.getInteger('startLineNumber') ?? 1;
        const uid = blockUid(context);
        const items = ordered.map(({ directive, index }, i) => {
          const n = String(i + 1);
          const note = `${PREFIX}-fn-${uid}-${n}`;
          const badge = `${PREFIX}-fnref-${uid}-${n}`;
          const lineEl = lineElement(directive.lines[0] as ExpressiveCodeLine);
          const code = lineEl && select('.code', lineEl);
          code?.children.push(
            h(
              'a',
              {
                class: cls('-badge'),
                href: `#${note}`,
                id: badge,
                ariaLabel: `Footnote ${n}`,
                ariaDescribedby: `${note}-text`,
                dataScbFn: n,
              },
              n,
            ),
          );
          return h('li', { id: note, tabindex: '-1', dataScbFn: n }, [
            h(
              'a',
              {
                class: cls('-num'),
                href: `#${badge}`,
                ariaLabel: `Footnote ${n}, for line ${numberedLines(codeBlock).indexOf(lines[index] as never) + start}`,
              },
              `${n}.`,
            ),
            h('span', { id: `${note}-text` }, inlineMarkdown(directive.text ?? '')),
          ]);
        });
        figure.properties.dataScbFootnotes = '';
        if (sticky) addClassName(figure, cls('s-sticky'));
        figure.children.splice(figure.children.indexOf(pre) + 1, 0, h('ol', { class: cls('s') }, items));
      },
    },
  };
}
