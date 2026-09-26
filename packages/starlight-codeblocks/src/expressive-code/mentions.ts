import { PluginStyleSettings, type StyleResolverFn, setAlpha, type UnresolvedStyleValue } from '@expressive-code/core';
import { select } from '@expressive-code/core/hast';
import { clientJsModules } from '../client-modules.ts';
import { type CodeblocksPlugin, warn } from './core.ts';
import { getDirectives } from './notation.ts';
import { PREFIX } from './styles.ts';

export interface MentionsStyleSettings {
  bar: UnresolvedStyleValue;
  background: UnresolvedStyleValue;
  fadeOpacity: UnresolvedStyleValue;
}

declare module '@expressive-code/core' {
  export interface StyleSettings {
    codeblocksMentions: MentionsStyleSettings;
  }
}

const styleSettings = new PluginStyleSettings({
  defaultValues: {
    codeblocksMentions: {
      bar: ({ resolveSetting }: Parameters<StyleResolverFn>[0]) => resolveSetting('codeblocks.accent'),
      // Light enough for every syntax colour as it is, so that a line keeps its colours when it lights up.
      background: ({ resolveSetting, theme }: Parameters<StyleResolverFn>[0]) =>
        setAlpha(resolveSetting('codeblocksMentions.bar'), theme.type === 'dark' ? 0.1 : 0.12),
      fadeOpacity: '0.42',
    },
  },
});

/** Tags lines with `[!mention <name>]`, so that links to `#mention:<name>` in the prose can highlight them. */
export function pluginMentions(): CodeblocksPlugin {
  return {
    name: 'starlight-codeblocks:mentions',
    directives: {
      mention: {
        placement: 'end',
        docs: {
          description: 'Tags the line with a name. A link to `#mention:<name>` in the prose highlights it.',
          args: 'A name for the line.',
          example: { lang: 'js', code: 'const base = 1 // [!mention base]' },
          page: 'features/code-mentions',
        },
      },
    },
    styleSettings,
    baseStyles: ({ cssVar }) => `
.${PREFIX}-mentioning .ec-line:not(.${PREFIX}-mention-on) { opacity: ${cssVar('codeblocksMentions.fadeOpacity')}; }
.${PREFIX}-mention-on {
  background: ${cssVar('codeblocksMentions.background')};
  box-shadow: inset 3px 0 ${cssVar('codeblocksMentions.bar')};
}
@media (prefers-reduced-motion: no-preference) {
  [data-scb-mentions] .ec-line { transition: opacity 0.2s ease; }
}`,
    jsModules: clientJsModules,
    hooks: {
      postprocessRenderedLine(context) {
        const names = getDirectives(context.codeBlock, 'mention')
          .filter((d) => d.lines.includes(context.line))
          .flatMap((d) => {
            if (d.args.length !== 1)
              warn(context, '`[!mention]` needs one name, such as `[!mention setup]`.', d.sourceLine);
            return d.args.slice(0, 1);
          });
        if (names.length > 0) context.renderData.lineAst.properties.dataScbMention = [...new Set(names)].join(' ');
      },
      postprocessRenderedBlock({ codeBlock, renderData }) {
        if (getDirectives(codeBlock, 'mention').length === 0) return;
        const figure = select('figure', renderData.blockAst) ?? renderData.blockAst;
        figure.properties.dataScbMentions = '';
      },
    },
  };
}
