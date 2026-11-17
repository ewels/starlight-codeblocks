import { type ExpressiveCodeLine, PluginStyleSettings, type UnresolvedStyleValue } from '@expressive-code/core';
import { type Element, h, select } from '@expressive-code/core/hast';
import { uiTexts } from '../translations.ts';
import { type CodeblocksPlugin, insertAfter, insertBefore, lineElement } from './core.ts';
import { isHiddenLine } from './hidden-lines.ts';
import { inlineMarkdown } from './inline-markdown.ts';
import { getRenderedDirectives } from './notation.ts';
import { markerColours, markerStyles, PREFIX } from './styles.ts';

export interface SkippedCodeStyleSettings {
  badgeBackground: UnresolvedStyleValue;
  rule: UnresolvedStyleValue;
}

declare module '@expressive-code/core' {
  export interface StyleSettings {
    codeblocksSkippedCode: SkippedCodeStyleSettings;
  }
}

const styleSettings = new PluginStyleSettings({ defaultValues: { codeblocksSkippedCode: markerColours } });

export interface SkippedCodeSettings {
  /** Lines that stand for `[!code skip]`, as the whole of a comment, or alone in JSON. None by default. */
  aliases?: string[];
}

/** Shows a marker where `[!code skip]` stands for code that the block leaves out. */
export function pluginSkippedCode({ aliases = [] }: SkippedCodeSettings = {}): CodeblocksPlugin {
  return {
    name: 'starlight-codeblocks:skipped-code',
    directives: {
      'code skip': {
        text: true,
        endOfBlock: true,
        aliases: aliases.map((alias) => alias.trim()),
        docs: {
          description: 'Shows a marker in place of code that the block leaves out.',
          args: 'Optional. The text of the marker.',
          example: { lang: 'js', code: 'function connect(host) {\n  // [!code skip]\n  return socket\n}' },
          page: 'features/skipped-code',
        },
      },
    },
    styleSettings,
    baseStyles: ({ cssVar }) => `
${markerStyles(cssVar, `${PREFIX}-skip-marker`, `${PREFIX}-skip-text`, 'codeblocksSkippedCode', 'dotted')}
.${PREFIX}-skip-marker { padding-inline-start: calc(var(--scb-gutter, 0px) + ${cssVar('codePaddingInline')}); }
/* An element, because a flex container drops text that is only whitespace. */
.${PREFIX}-skip-indent { white-space: pre; line-height: 0; }
/* A marker between hidden lines shows with them. */
.${PREFIX}-skip-hidden:not(.${PREFIX}-hidden-open) { display: none; }
`,
    hooks: {
      postprocessRenderedBlock(context) {
        const directives = getRenderedDirectives(context, 'code skip');
        const code = directives.length > 0 && select('pre > code', context.renderData.blockAst);
        if (!code) return;
        const say = uiTexts(context.locale);
        const { codeBlock } = context;
        const all = codeBlock.getLines();
        const hiddenBefore = (line: ExpressiveCodeLine) =>
          isHiddenLine(codeBlock, line) && isHiddenLine(codeBlock, all[all.indexOf(line) - 1] as ExpressiveCodeLine);
        // Markers after a line keep their source order.
        const lastAfter = new Map<Element, Element>();
        for (const { lines, text, after, indent } of directives) {
          const line = lines[0];
          const el = line && lineElement(line);
          if (!el) continue;
          const hidden = !after && hiddenBefore(line);
          const marker = h('div', { class: `${PREFIX}-skip-marker${hidden ? ` ${PREFIX}-skip-hidden` : ''}` }, [
            ...(indent ? [h('span', { class: `${PREFIX}-skip-indent` }, indent)] : []),
            h('span', { class: `${PREFIX}-skip-text` }, text ? inlineMarkdown(text) : say('skippedCode.marker')),
          ]);
          if (after) {
            insertAfter(code, lastAfter.get(el) ?? el, marker);
            lastAfter.set(el, marker);
          } else insertBefore(code, el, marker);
        }
      },
    },
  };
}
