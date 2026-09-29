import {
  type AnnotationRenderOptions,
  ExpressiveCodeAnnotation,
  PluginStyleSettings,
  type UnresolvedStyleValue,
} from '@expressive-code/core';
import { h, select, toText } from '@expressive-code/core/hast';
import { clientJsModules } from '../client-modules.ts';
import { getRegistry } from '../registry.ts';
import { apiCardStyles, sentences } from './api-links.ts';
import { type CodeblocksPlugin, isSafeUrl, warn, withBase } from './core.ts';
import { inlineMarkdown } from './inline-markdown.ts';
import { getDirectives } from './notation.ts';
import { PREFIX, tint } from './styles.ts';

export interface CodeLinksStyleSettings {
  /** The underline that marks the link. Needs 3:1 contrast on the code background. */
  underline: UnresolvedStyleValue;
  hoverBackground: UnresolvedStyleValue;
}

declare module '@expressive-code/core' {
  export interface StyleSettings {
    codeblocksCodeLinks: CodeLinksStyleSettings;
  }
}

const styleSettings = new PluginStyleSettings({
  defaultValues: {
    codeblocksCodeLinks: {
      underline: ({ resolveSetting }) => resolveSetting('codeblocks.accent'),
      hoverBackground: (context) => tint(context.resolveSetting('codeblocks.accent'), context),
    },
  },
});

class LinkAnnotation extends ExpressiveCodeAnnotation {
  constructor(
    private readonly properties: Record<string, string>,
    inlineRange: { columnStart: number; columnEnd: number },
  ) {
    super({ inlineRange });
  }
  render({ nodesToTransform }: AnnotationRenderOptions) {
    return nodesToTransform.map((node) => h('a', { class: `${PREFIX}-link`, ...this.properties }, [node]));
  }
}

/**
 * Turns the first match of `/text/` on the next line into a link, from `[!link /text/ <url>]`.
 * Text after the directive shows in the API links card.
 */
export function pluginCodeLinks({ base }: { base?: string } = {}): CodeblocksPlugin {
  return {
    name: 'starlight-codeblocks:code-links',
    directives: {
      link: {
        text: true,
        docs: {
          description:
            'Links the first match of `/text/` on the line to the URL. Text after the directive shows in a card on hover and focus.',
          args: '`/text/` to link, then the URL, then optional text for the card.',
          example: {
            lang: 'js',
            code: '// [!link /const/ https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/const]\nconst port = 8080',
          },
          page: 'features/code-links',
        },
      },
    },
    jsModules: clientJsModules,
    styleSettings,
    baseStyles: ({ cssVar }) => `
.${PREFIX}-link {
  color: inherit;
  text-decoration: underline;
  text-decoration-color: ${cssVar('codeblocksCodeLinks.underline')};
  text-underline-offset: 3px;
}
.${PREFIX}-link:hover {
  background: ${cssVar('codeblocksCodeLinks.hoverBackground')};
}
${apiCardStyles(cssVar)}`,
    hooks: {
      annotateCode(context) {
        const root = base ?? getRegistry()?.base;
        for (const directive of getDirectives(context.codeBlock, 'link')) {
          const [url, ...extra] = directive.args;
          if (directive.match === undefined || url === undefined || extra.length > 0) {
            warn(
              context,
              '`[!link]` needs the text to link and one URL, such as `[!link /Path/ https://example.com/]`.',
              directive.sourceLine,
            );
            continue;
          }
          if (!isSafeUrl(url)) {
            warn(context, `\`[!link]\` needs a relative, http or https URL, not \`${url}\`.`, directive.sourceLine);
            continue;
          }
          const line = directive.lines[0];
          const start = line?.text.indexOf(directive.match) ?? -1;
          if (!line || start === -1) continue;
          const href = withBase(url, root);
          const properties: Record<string, string> = { href };
          const summary = directive.text && toText(h('span', inlineMarkdown(directive.text)));
          if (summary) {
            const source = /^https?:/.test(href) ? new URL(href).hostname : undefined;
            properties['aria-description'] = sentences(summary, source);
            properties.dataScbApiHead = directive.match;
            properties.dataScbApiSummary = summary;
            if (source) properties.dataScbApiSource = source;
          }
          line.addAnnotation(
            new LinkAnnotation(properties, { columnStart: start, columnEnd: start + directive.match.length }),
          );
        }
      },
      postprocessRenderedBlock({ renderData }) {
        if (!select(`.${PREFIX}-link[data-scb-api-head]`, renderData.blockAst)) return;
        const figure = select('figure', renderData.blockAst);
        if (figure) figure.properties.dataScbApiLinks = '';
      },
    },
  };
}
