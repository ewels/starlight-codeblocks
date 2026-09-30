import {
  type ExpressiveCodeLine,
  ensureColorContrastOnBackground,
  mix,
  onBackground,
  PluginStyleSettings,
  setAlpha,
  type UnresolvedStyleValue,
} from '@expressive-code/core';
import { addClassName, h, select } from '@expressive-code/core/hast';
import { clientJsModules } from '../client-modules.ts';
import {
  blockSetting,
  blockUid,
  type CodeblocksPlugin,
  lineElement,
  lineNumber,
  parseBoolean,
  startNoteNumber,
  warn,
} from './core.ts';
import { inlineMarkdown } from './inline-markdown.ts';
import { getRenderedDirectives } from './notation.ts';
import { litLine, onCode, PREFIX, solidCodeBackground, solidCodeForeground, themeColour } from './styles.ts';

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
      accent: (context) => onCode(context, themeColour(context, 'terminal.ansiMagenta'), 4.5),
      // Readable on the code and on the tint of an active line.
      numberForeground: (context) =>
        ensureColorContrastOnBackground(
          onCode(
            context,
            mix(context.resolveSetting('codeblocksFootnotes.accent'), solidCodeForeground(context), 0.3),
            4.5,
          ),
          context.resolveSetting('codeblocksFootnotes.lineBackground'),
          4.5,
        ),
      activeForeground: (context) =>
        ensureColorContrastOnBackground(
          solidCodeBackground(context),
          context.resolveSetting('codeblocksFootnotes.accent'),
          4.5,
        ),
      // Light enough for every syntax colour as it is, so that a line keeps its colours when it lights up.
      lineBackground: (context) =>
        onBackground(setAlpha(context.resolveSetting('codeblocksFootnotes.accent'), 0.1), solidCodeBackground(context)),
      stickyShadow: ['0 -8px 16px rgb(10 14 24 / 0.35)', '0 -6px 14px rgb(12 20 36 / 0.1)'],
    },
  },
});

const cls = (suffix = '') => `${PREFIX}-footnote${suffix}`;

/** Turns `[!ref] text` on or above a line into a numbered badge on the line and an item in a list under the block. */
export function pluginFootnotes({ sticky: siteSticky = false }: { sticky?: boolean } = {}): CodeblocksPlugin {
  return {
    name: 'starlight-codeblocks:footnotes',
    directives: {
      ref: {
        text: true,
        docs: {
          description: 'Adds a numbered badge to the line, and the text to a list under the block.',
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
.frame:has(> .${cls('s')}) > :is(pre, .${PREFIX}-expandable-bar) { border-end-start-radius: 0; border-end-end-radius: 0; }
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
}
.${cls('-badge')}:hover { background: color-mix(in srgb, ${v('accent')} 18%, transparent); }
${litLine(`.${cls('-on')}, .${cls('-peek')}`, v('lineBackground'), v('accent'))}
.ec-line:is(.${cls('-on')}, .${cls('-peek')}) .${cls('-badge')} { background: ${v('accent')}; color: ${v('activeForeground')}; }
.${cls('s')} {
  margin: 0;
  /* Starts a one-digit number, such as "1.", at the right of its 24px target, level with the code. */
  padding: 0.6rem 1.1rem 0.75rem max(0px, calc(${cssVar('codePaddingInline')} + 2ch - max(2.5ch, 24px)));
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
/* The same tint and bar as its line. The padding reaches past the text by as much as the margin pulls back. */
.${cls('s')} li {
  display: flex;
  align-items: baseline;
  gap: 1ch;
  margin: 0 -0.5rem;
  padding-block: 1px;
  padding-inline: calc(0.5rem - 3px) 0.5rem;
  border-inline-start: 3px solid transparent;
  border-radius: 0 3px 3px 0;
  cursor: pointer;
  scroll-margin-block: 5rem;
}
.${cls('s')} li:is(.${cls('-on')}, .${cls('-peek')}) {
  border-inline-start-color: ${v('accent')};
  background: ${v('lineBackground')};
  color: ${cssVar('codeForeground')};
}
/* A short delay before a hover highlight, so that it does not flash while the pointer passes over. */
@media (prefers-reduced-motion: no-preference) {
  [data-scb-footnotes] .ec-line, [data-scb-footnotes] .ec-line .code, .${cls('-badge')}, .${cls('s')} li {
    transition: background-color 160ms ease-out, border-color 160ms ease-out, color 160ms ease-out;
  }
  :is(.ec-line, li).${cls('-peek')}:not(.${cls('-on')}),
  .ec-line.${cls('-peek')}:not(.${cls('-on')}) :is(.code, .${cls('-badge')}) {
    transition-delay: 80ms;
  }
}
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
/* 10%, not 12%, keeps 4.5:1 on the sticky list for themes whose code colour is near 4.5:1. */
.frame .${cls('s')} li code {
  color: ${cssVar('codeForeground')};
  background: color-mix(in srgb, currentColor 10%, transparent);
}
.${cls('s-sticky')} .${cls('s')} {
  position: sticky;
  bottom: 0;
  z-index: 2;
  /* The top border overlaps the bottom border of the code, and shows when the list floats over the code. */
  margin-top: calc(-1 * ${cssVar('borderWidth')});
  border-top: ${cssVar('borderWidth')} solid ${cssVar('borderColor')};
  background: color-mix(in srgb, ${cssVar('codeForeground')} 5%, ${cssVar('codeBackground')});
  box-shadow: ${v('stickyShadow')};
}`;
    },
    jsModules: clientJsModules,
    hooks: {
      postprocessRenderedBlock(context) {
        const { codeBlock, renderData } = context;
        const refs = getRenderedDirectives(context, 'ref');
        const figure = select('figure', renderData.blockAst);
        const pre = figure && select('pre', figure);
        if (refs.length === 0 || !figure || !pre) return;
        const attribute = codeBlock.metaOptions.getString('footnotes');
        if (attribute !== undefined && attribute !== 'sticky' && attribute !== 'static') {
          warn(context, `\`footnotes="${attribute}"\` must be \`"sticky"\` or \`"static"\`. The plugin ignores it.`);
        }
        const sticky = blockSetting(
          context,
          'footnotes.sticky',
          parseBoolean,
          attribute === 'sticky' || (attribute !== 'static' && siteSticky),
          '`true` or `false`',
        );
        const uid = blockUid(context);
        const start = startNoteNumber(context);
        const items = refs.map((directive, i) => {
          const n = String(start + i);
          const note = `${PREFIX}-fn-${uid}-${n}`;
          const badge = `${PREFIX}-fnref-${uid}-${n}`;
          const line = directive.lines[0] as ExpressiveCodeLine;
          const lineEl = lineElement(line);
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
                ariaLabel: `Footnote ${n}, for line ${lineNumber(codeBlock, line)}`,
              },
              `${n}.`,
            ),
            h('span', { id: `${note}-text` }, inlineMarkdown(directive.text ?? '')),
          ]);
        });
        figure.properties.dataScbFootnotes = '';
        if (sticky) addClassName(figure, cls('s-sticky'));
        // Below the expandable bar, so that the bar stays under the code it expands, and above the run output.
        const find = (name: string) =>
          figure.children.find(
            (child) =>
              child.type === 'element' &&
              (child.properties.className as string[] | undefined)?.includes(`${PREFIX}-${name}`),
          );
        const bar = find('expandable-bar');
        const output = find('run-output');
        const list = h('ol', { class: cls('s'), start: start > 1 ? start : undefined }, items);
        if (output) figure.children.splice(figure.children.indexOf(output), 0, list);
        else figure.children.splice(figure.children.indexOf(bar ?? pre) + 1, 0, list);
      },
    },
  };
}
