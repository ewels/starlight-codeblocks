import {
  AttachedPluginData,
  onBackground,
  PluginStyleSettings,
  setAlpha,
  type UnresolvedStyleValue,
} from '@expressive-code/core';
import { h, select } from '@expressive-code/core/hast';
import { uiTexts } from '../translations.ts';
import { type CodeblocksPlugin, insertAfter, insertBefore, lineElement } from './core.ts';
import { inlineMarkdown } from './inline-markdown.ts';
import { getDirectives, getRenderedDirectives } from './notation.ts';
import { PREFIX, solidCodeBackground } from './styles.ts';

export interface SkippedCodeStyleSettings {
  badgeBackground: UnresolvedStyleValue;
  rule: UnresolvedStyleValue;
}

declare module '@expressive-code/core' {
  export interface StyleSettings {
    codeblocksSkippedCode: SkippedCodeStyleSettings;
  }
}

const styleSettings = new PluginStyleSettings({
  defaultValues: {
    codeblocksSkippedCode: {
      badgeBackground: (context) =>
        onBackground(setAlpha(context.resolveSetting('codeblocks.mutedForeground'), 0.1), solidCodeBackground(context)),
      rule: ({ resolveSetting }) => setAlpha(resolveSetting('codeblocks.mutedForeground'), 0.35),
    },
  },
});

/** The indentation of each directive's source line, by source line. */
const indentData = new AttachedPluginData<Map<number, string>>(() => new Map());

export interface SkippedCodeSettings {
  /** Lines that stand for `[!code skip]`, alone or as the whole of a comment. */
  aliases?: string[];
}

/** Shows a marker where `[!code skip]` stands for code that the block leaves out. */
export function pluginSkippedCode({ aliases = ['...'] }: SkippedCodeSettings = {}): CodeblocksPlugin {
  return {
    name: 'starlight-codeblocks:skipped-code',
    directives: {
      'code skip': {
        text: true,
        endOfBlock: true,
        aliases,
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
.${PREFIX}-skip-marker {
  display: flex;
  align-items: center;
  position: relative;
  margin: 2px 0;
  padding-inline-start: calc(var(--scb-gutter, 0px) + ${cssVar('codePaddingInline')});
  color: ${cssVar('codeblocks.mutedForeground')};
  user-select: none;
  -webkit-user-select: none;
}
/* An element, because a flex container drops text that is only whitespace. */
.${PREFIX}-skip-indent { white-space: pre; line-height: 0; }
.${PREFIX}-skip-marker::before {
  content: '';
  position: absolute;
  top: 50%;
  inset-inline: calc(var(--scb-gutter, 0px) + ${cssVar('codePaddingInline')}) ${cssVar('codePaddingInline')};
  border-top: 1px dotted ${cssVar('codeblocksSkippedCode.rule')};
}
.${PREFIX}-skip-text {
  position: relative;
  z-index: 1;
  padding: 0.05em 0.65em;
  border-radius: 999px;
  background: ${cssVar('codeblocksSkippedCode.badgeBackground')};
  font-size: 0.8125em;
  line-height: 1.6;
}
`,
    hooks: {
      // The notation plugin deletes the directive's own line in `preprocessCode`.
      preprocessMetadata({ codeBlock }) {
        const lines = codeBlock.getLines();
        const indents = indentData.getOrCreateFor(codeBlock);
        for (const { sourceLine } of getDirectives(codeBlock, 'code skip')) {
          indents.set(sourceLine, lines[sourceLine - 1]?.text.match(/^\s*/)?.[0] ?? '');
        }
      },
      postprocessRenderedBlock(context) {
        const code = select('pre > code', context.renderData.blockAst);
        if (!code) return;
        const say = uiTexts(context.locale);
        const indents = indentData.getOrCreateFor(context.codeBlock);
        for (const { lines, text, after, sourceLine } of getRenderedDirectives(context, 'code skip')) {
          const line = lines[0] && lineElement(lines[0]);
          if (!line) continue;
          const indent = indents.get(sourceLine);
          const marker = h('div', { class: `${PREFIX}-skip-marker` }, [
            ...(indent ? [h('span', { class: `${PREFIX}-skip-indent` }, indent)] : []),
            h('span', { class: `${PREFIX}-skip-text` }, text ? inlineMarkdown(text) : say('skippedCode.marker')),
          ]);
          (after ? insertAfter : insertBefore)(code, line, marker);
        }
      },
    },
  };
}
