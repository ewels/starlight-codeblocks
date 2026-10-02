import {
  type ExpressiveCodeLine,
  ensureColorContrastOnBackground,
  mix,
  onBackground,
  PluginStyleSettings,
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
  noteStyle,
  parseBoolean,
  startNoteNumber,
  warn,
} from './core.ts';
import { inlineMarkdown } from './inline-markdown.ts';
import { getRenderedDirectives } from './notation.ts';
import {
  hoverColour,
  litLine,
  type NoteStyle,
  noteStyleVars,
  type OutlineStyleSettings,
  onCode,
  outlineColours,
  PREFIX,
  solidCodeBackground,
  solidCodeForeground,
  tint,
} from './styles.ts';

export interface FootnotesStyleSettings extends OutlineStyleSettings {
  /** The badge background and the bar of a selected line. */
  accent: UnresolvedStyleValue;
  /** List numbers. Needs 4.5:1 on the code background. */
  numberForeground: UnresolvedStyleValue;
  /** The number on a badge. */
  activeForeground: UnresolvedStyleValue;
  /** The badge under the pointer, with focus or on a selected line. */
  activeBackground: UnresolvedStyleValue;
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
      accent: ({ resolveSetting }) => resolveSetting('codeblocks.accent'),
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
      activeBackground: (context) => hoverColour(context.resolveSetting('codeblocksFootnotes.accent'), context),
      // Light enough for every syntax colour as it is, so that a line keeps its colours when it lights up.
      lineBackground: (context) =>
        onBackground(tint(context.resolveSetting('codeblocksFootnotes.accent'), context), solidCodeBackground(context)),
      ...outlineColours('codeblocksFootnotes'),
      stickyShadow: ['0 -8px 16px rgb(10 14 24 / 0.35)', '0 -6px 14px rgb(12 20 36 / 0.1)'],
    },
  },
});

const cls = (suffix = '') => `${PREFIX}-footnote${suffix}`;

/** Turns `[!ref] text` on or above a line into a numbered badge on the line and an item in a list under the block. */
export function pluginFootnotes({
  sticky: siteSticky = false,
  style: siteStyle = 'outline',
}: {
  sticky?: boolean;
  style?: NoteStyle;
} = {}): CodeblocksPlugin {
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
${noteStyleVars(
  cssVar,
  { attribute: 'data-scb-footnotes', prefix: 'fn', group: 'codeblocksFootnotes' },
  {
    bg: v('accent'),
    fg: v('activeForeground'),
    activeBg: v('activeBackground'),
    line: v('lineBackground'),
    bar: v('accent'),
    num: v('numberForeground'),
  },
)}
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
  /* Forced colours remove the background, but draw the border. */
  border: 1px solid var(--scb-fn-border);
  border-radius: 999px;
  background: var(--scb-fn-bg);
  color: var(--scb-fn-fg);
  font: 600 0.8em/1 ${cssVar('codeFontFamily')};
  text-decoration: none;
  vertical-align: 0.1em;
  user-select: none;
  -webkit-user-select: none;
  scroll-margin-block: 5rem;
}
.${cls('-badge')}:is(:hover, :focus-visible) { background: var(--scb-fn-hover-bg); }
${litLine(`.${cls('-on')}, .${cls('-peek')}`, 'var(--scb-fn-line)', 'var(--scb-fn-bar)')}
.ec-line:is(.${cls('-on')}, .${cls('-peek')}) .${cls('-badge')} { background: var(--scb-fn-active-bg); color: var(--scb-fn-active-fg); }
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
  border-inline-start-color: var(--scb-fn-bar);
  background: var(--scb-fn-line);
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
  color: var(--scb-fn-num);
  font-weight: 600;
  text-align: end;
  text-decoration: none;
}
.${cls('s')} li > span {
  font-family: ${cssVar('uiFontFamily')};
  font-size: 0.9375rem;
  line-height: 1.45;
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
        figure.properties.dataScbFootnotes = noteStyle(context, 'footnotes.style', siteStyle);
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
