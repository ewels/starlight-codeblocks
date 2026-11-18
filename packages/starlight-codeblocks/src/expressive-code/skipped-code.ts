import { type ExpressiveCodeLine, PluginStyleSettings, type UnresolvedStyleValue } from '@expressive-code/core';
import { addClassName, h, select } from '@expressive-code/core/hast';
import { uiTexts } from '../translations.ts';
import { type CodeblocksPlugin, lineElement } from './core.ts';
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
  /** Comments that stand for `[!code skip]` when they hold only an alias, by language, with `*` for the others. */
  commentAliases?: Record<string, string[]>;
  /** Lines that stand for `[!code skip]` when they hold only an alias, by language, with `*` for the others. */
  bareAliases?: Record<string, string[]>;
}

export const defaultSkipAliases = { comment: { '*': ['...'] }, bare: { json: ['...'] } };

const trimmed = (aliases: Record<string, string[]>) =>
  Object.fromEntries(Object.entries(aliases).map(([language, list]) => [language, list.map((alias) => alias.trim())]));

/** Draws a `[!code skip]` line, which stands for code that the block leaves out, as a marker. */
export function pluginSkippedCode({
  commentAliases = {},
  bareAliases = {},
}: SkippedCodeSettings = {}): CodeblocksPlugin {
  return {
    name: 'starlight-codeblocks:skipped-code',
    directives: {
      'code skip': {
        text: true,
        ownLine: true,
        aliases: {
          comment: trimmed({ ...defaultSkipAliases.comment, ...commentAliases }),
          bare: trimmed({ ...defaultSkipAliases.bare, ...bareAliases }),
        },
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
/* Not zero width or in a flex container: Chromium leaves either out of a manual selection. */
.${PREFIX}-skip-source { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: pre; }
.${PREFIX}-skip-marker { display: inline-flex; position: static; }
.${PREFIX}-skip-marker::before { inset-inline: ${cssVar('codePaddingInline')}; }
@media (hover: none) {
  .ec-line:first-child .${PREFIX}-skip-marker::before { inset-inline-end: calc(${cssVar('codePaddingInline')} + 2.5rem); }
}
`,
    hooks: {
      postprocessRenderedBlock(context) {
        const say = uiTexts(context.locale);
        for (const { lines, text } of getRenderedDirectives(context, 'code skip')) {
          const line = lines[0] as ExpressiveCodeLine;
          const el = lineElement(line);
          const code = el && select('.code', el);
          if (!code) continue;
          addClassName(el, `${PREFIX}-skip-line`);
          // A real diff keeps its `+` or `-` prefix in the text.
          const indent = line.text.match(/^(?:[+-](?![+-]))?\s*/)?.[0] ?? '';
          code.children = [
            ...(indent ? [{ type: 'text' as const, value: indent }] : []),
            h('span', { class: `${PREFIX}-skip-source`, ariaHidden: 'true' }, line.text.slice(indent.length)),
            h('span', { class: `${PREFIX}-skip-marker` }, [
              h('span', { class: `${PREFIX}-skip-text` }, text ? inlineMarkdown(text) : say('skippedCode.marker')),
            ]),
          ];
        }
      },
    },
  };
}
