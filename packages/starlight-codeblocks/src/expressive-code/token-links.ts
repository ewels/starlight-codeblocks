import {
  type AnnotationRenderOptions,
  ExpressiveCodeAnnotation,
  PluginStyleSettings,
  type UnresolvedStyleValue,
} from '@expressive-code/core';
import { h } from '@expressive-code/core/hast';
import { getRegistry } from '../registry.ts';
import { type CodeblocksPlugin, isSafeUrl, warn } from './core.ts';
import { getDirectives } from './notation.ts';
import { PREFIX } from './styles.ts';

export interface TokenLinksStyleSettings {
  /** The underline that marks the link. Needs 3:1 contrast on the code background. */
  underline: UnresolvedStyleValue;
  hoverBackground: UnresolvedStyleValue;
}

declare module '@expressive-code/core' {
  export interface StyleSettings {
    codeblocksTokenLinks: TokenLinksStyleSettings;
  }
}

const styleSettings = new PluginStyleSettings({
  defaultValues: {
    codeblocksTokenLinks: {
      underline: ({ resolveSetting }) => resolveSetting('codeblocks.accent'),
      hoverBackground: ({ resolveSetting }) =>
        `color-mix(in srgb, ${resolveSetting('codeblocks.accent')} 12%, transparent)`,
    },
  },
});

class LinkAnnotation extends ExpressiveCodeAnnotation {
  constructor(
    private readonly href: string,
    inlineRange: { columnStart: number; columnEnd: number },
  ) {
    super({ inlineRange });
  }
  render({ nodesToTransform }: AnnotationRenderOptions) {
    return nodesToTransform.map((node) => h('a', { class: `${PREFIX}-link`, href: this.href }, [node]));
  }
}

/** Adds Astro's `base` to a site-relative URL, unless the URL already starts with it. */
export function withBase(url: string, base = '/') {
  const root = base.replace(/\/$/, '');
  if (!root || !url.startsWith('/') || url.startsWith('//')) return url;
  return url === root || url.startsWith(`${root}/`) ? url : root + url;
}

/** Turns the first match of `/text/` on the next line into a link, from `[!link /text/ <url>]`. */
export function pluginTokenLinks({ base }: { base?: string } = {}): CodeblocksPlugin {
  return {
    name: 'starlight-codeblocks:token-links',
    directives: {
      link: {
        placement: 'own',
        docs: {
          description: 'Links the first match of `/text/` on the next line to the URL.',
          args: '`/text/` to link, then the URL.',
          example: {
            lang: 'js',
            code: '// [!link /const/ https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/const]\nconst port = 8080',
          },
          page: 'features/token-links',
        },
      },
    },
    styleSettings,
    baseStyles: ({ cssVar }) => `
.${PREFIX}-link {
  color: inherit;
  text-decoration: underline;
  text-decoration-color: ${cssVar('codeblocksTokenLinks.underline')};
  text-underline-offset: 3px;
}
.${PREFIX}-link:hover {
  background: ${cssVar('codeblocksTokenLinks.hoverBackground')};
}`,
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
          line.addAnnotation(
            new LinkAnnotation(withBase(url, root), { columnStart: start, columnEnd: start + directive.match.length }),
          );
        }
      },
    },
  };
}
