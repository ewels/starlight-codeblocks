import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  type AnnotationRenderOptions,
  ExpressiveCodeAnnotation,
  type ExpressiveCodeHookContextBase,
  mix,
  PluginStyleSettings,
  type ResolverContext,
  type UnresolvedStyleValue,
} from '@expressive-code/core';
import { h, select, selectAll } from '@expressive-code/core/hast';
import { clientJsModules } from '../client-modules.ts';
import type { AdapterContext, ApiLinkAdapter, SymbolRef } from '../options.ts';
import { getRegistry } from '../registry.ts';
import { type CodeblocksPlugin, isSafeUrl, languageId, withBase } from './core.ts';
import { getDirectives } from './notation.ts';
import { isShellOutput, pythonSessionPrompts } from './shell-copy.ts';
import { onCode, PREFIX, solidCodeBackground, solidCodeForeground, tint } from './styles.ts';

export interface ApiLinksStyleSettings {
  /** The dotted underline that marks a link. Needs 3:1 contrast on the code background. */
  underline: UnresolvedStyleValue;
  hoverUnderline: UnresolvedStyleValue;
  hoverBackground: UnresolvedStyleValue;
}

declare module '@expressive-code/core' {
  export interface StyleSettings {
    codeblocksApiLinks: ApiLinksStyleSettings;
  }
}

const styleSettings = new PluginStyleSettings({
  defaultValues: {
    codeblocksApiLinks: {
      underline: (context) => onCode(context, mix(solidCodeForeground(context), solidCodeBackground(context), 0.45), 3),
      hoverUnderline: ({ resolveSetting }) => resolveSetting('codeblocks.accent'),
      hoverBackground: (context) => tint(context.resolveSetting('codeblocks.accent'), context),
    },
  },
});

const cls = (suffix = '') => `${PREFIX}-api-link${suffix}`;

class ApiLinkAnnotation extends ExpressiveCodeAnnotation {
  constructor(
    private readonly properties: Record<string, string>,
    inlineRange: { columnStart: number; columnEnd: number },
  ) {
    // Last, so that the parts of the name merge into one node and the name gets one link.
    super({ inlineRange, renderPhase: 'latest' });
  }
  render({ nodesToTransform }: AnnotationRenderOptions) {
    return nodesToTransform.map((node) => h('a', this.properties, [node]));
  }
}

/** The default folder for fetched files. Outside Astro's cache folder, which sites often clear. */
export const fetchCacheDir = (root: string) => join(root, 'node_modules', '.cache', 'starlight-codeblocks');

/**
 * Gets a URL once and keeps the body in `dir`. Later calls, in this build or a later one, read the file.
 * A body that fails `check` is never kept, and a kept one that fails it is fetched again.
 * ponytail: no expiry; delete the folder to fetch again.
 */
export async function cachedFetch(
  url: string,
  dir: string,
  warn: (message: string) => void,
  check: (body: Uint8Array) => void = () => {},
) {
  const file = join(dir, createHash('sha256').update(url).digest('hex').slice(0, 24));
  try {
    const body = new Uint8Array(await readFile(file));
    check(body);
    return body;
  } catch {}
  let body: Uint8Array;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    body = new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    warn(
      `could not fetch ${url} (${error instanceof Error ? error.message : error}). Names from it stay plain text in this build.`,
    );
    return null;
  }
  try {
    check(body);
  } catch (error) {
    warn(`${url} is ${error instanceof Error ? error.message : error}. Names from it stay plain text.`);
    return null;
  }
  try {
    await mkdir(dir, { recursive: true });
    const partial = `${file}.${process.pid}.part`;
    await writeFile(partial, body);
    await rename(partial, file);
  } catch {}
  return body;
}

const setups = new WeakMap<ApiLinkAdapter, Promise<boolean>>();

function ready(adapter: ApiLinkAdapter, { config }: Pick<ExpressiveCodeHookContextBase, 'config'>) {
  let setup = setups.get(adapter);
  if (!setup) {
    const registry = getRegistry();
    const root = registry?.root ?? process.cwd();
    const warn = (message: string) => config.logger.warn(`API links, ${adapter.name} adapter: ${message}`);
    const context: AdapterContext = {
      root,
      cacheDir: registry?.cacheDir ?? join(root, 'node_modules', '.astro'),
      fetch: (url, check) => cachedFetch(url, fetchCacheDir(root), warn, check),
      warn,
    };
    setup = Promise.resolve()
      .then(() => adapter.setup(context))
      .then(
        () => true,
        (error) => {
          warn(`setup failed, so it links nothing: ${error instanceof Error ? error.message : error}`);
          return false;
        },
      );
    setups.set(adapter, setup);
  }
  return setup;
}

let brandIcons: Promise<{ paths: Map<string, string>; slug: (title: string) => string }> | undefined;

/** Simple Icons paths by slug. Loaded on the first block with an API link, because the set is large. */
const loadIcons = () =>
  (brandIcons ??= Promise.all([import('simple-icons'), import('simple-icons/sdk')]).then(([icons, sdk]) => ({
    paths: new Map(
      Object.values(icons).flatMap((icon) => (icon && 'slug' in icon ? [[icon.slug, icon.path] as const] : [])),
    ),
    slug: sdk.titleToSlug,
  })));

/** The Simple Icons slug for a link: the adapter's own, or the project at the start of `source`. */
export async function iconSlug({ icon, source }: SymbolRef) {
  if (icon === false) return undefined;
  const { paths, slug } = await loadIcons();
  // "Python 3.14 documentation" is the project "Python".
  const project = source.replace(/\s+(api\s+)?(documentation|docs|reference)$/i, '').replace(/\s+v?\d[\w.-]*$/, '');
  const candidate = icon ?? slug(project);
  return paths.has(candidate) ? candidate : undefined;
}

/** The line at the top of the card: the signature, or the kind and qualified name. */
const cardHead = ({ signature, kind, name }: SymbolRef) => signature ?? [kind, name].filter(Boolean).join(' ');

/** The card's own layout, shared with the card outside code blocks (`src/api-card-page.ts`). */
export const apiCardStyles = (cssVar: ResolverContext['cssVar']) => `.${PREFIX}-api-card {
  --scb-float-width: calc(${cssVar('codeblocks.popoverMaxWidth')} + 20px);
}
.${PREFIX}-api-card > span { display: block; }
.${PREFIX}-api-card-head {
  margin-bottom: 0.35rem;
  font-family: ${cssVar('codeFontFamily')};
  font-size: 0.78rem;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.${PREFIX}-api-card-summary { margin-bottom: 0.25rem; }
.${PREFIX}-api-card-source {
  color: ${cssVar('codeblocks.mutedForeground')};
  font-style: italic;
}
.${PREFIX}-api-card-source svg {
  width: 1em;
  height: 1em;
  margin-inline-end: 0.4em;
  vertical-align: -0.125em;
  fill: currentColor;
}
.${PREFIX}-api-card-action { color: ${cssVar('codeblocks.mutedForeground')}; }`;

export const sentences = (...parts: (string | undefined)[]) =>
  parts
    .filter(Boolean)
    .map((part) => (/[.!?]$/.test(part as string) ? part : `${part}.`))
    .join(' ');

/** Links names in code to their reference pages through language adapters, with a hover card. */
export function pluginApiLinks({ adapters, base }: { adapters: ApiLinkAdapter[]; base?: string }): CodeblocksPlugin {
  return {
    name: 'starlight-codeblocks:api-links',
    jsModules: clientJsModules,
    styleSettings,
    baseStyles: ({ cssVar }) => `
.${cls()} {
  color: inherit;
  text-decoration: underline dotted;
  text-decoration-color: ${cssVar('codeblocksApiLinks.underline')};
  text-underline-offset: 3px;
}
.${cls()}:hover, .${cls()}:focus-visible {
  text-decoration-style: solid;
  text-decoration-color: ${cssVar('codeblocksApiLinks.hoverUnderline')};
  background: ${cssVar('codeblocksApiLinks.hoverBackground')};
}
${apiCardStyles(cssVar)}`,
    hooks: {
      async annotateCode(context) {
        const { codeBlock } = context;
        if (codeBlock.metaOptions.getBoolean('apiLinks') === false) return;
        const lang = languageId(codeBlock.language);
        const active = adapters.filter((adapter) => adapter.languages.some((l) => languageId(l) === lang));
        if (active.length === 0) return;
        const root = base ?? getRegistry()?.base;
        const lines = codeBlock.getLines();
        const codeLinked = new Set(getDirectives(codeBlock, 'link').flatMap((d) => d.lines));
        // Output lines of a shell or Python session are not code. Without shell copy, the session
        // prompts are still in the text: blank them with spaces so that columns stay valid.
        const shellCopied = lines.some((line) => isShellOutput(codeBlock, line));
        const session = shellCopied ? new Map() : pythonSessionPrompts(codeBlock.language, lines);
        const texts = lines.map((line) => {
          if (shellCopied && isShellOutput(codeBlock, line)) return '';
          if (session.size === 0) return line.text;
          const prompt = session.get(line);
          return prompt ? ' '.repeat(prompt.length) + line.text.slice(prompt.length) : '';
        });
        const starts: number[] = [];
        let offset = 0;
        for (const text of texts) {
          starts.push(offset);
          offset += text.length + 1;
        }
        const code = texts.join('\n');
        const taken: [number, number][] = [];
        const attributes = Object.fromEntries(
          codeBlock.metaOptions.list(undefined, 'string').flatMap(({ key, value }) => (key ? [[key, value]] : [])),
        );
        for (const adapter of active) {
          if (!(await ready(adapter, context))) continue;
          for (const symbol of adapter.findSymbols(code, codeBlock.language, attributes)) {
            const { start, end } = symbol;
            if (end <= start || taken.some(([s, e]) => start < e && end > s)) continue;
            const index = starts.findLastIndex((s) => s <= start);
            const line = lines[index];
            const lineStart = starts[index] ?? 0;
            if (!line || codeLinked.has(line) || end > lineStart + (texts[index]?.length ?? 0)) continue;
            if (!isSafeUrl(symbol.href)) continue;
            const head = cardHead(symbol);
            const properties: Record<string, string> = {
              class: cls(),
              href: withBase(symbol.href, root),
              'aria-description': sentences(head, symbol.summary, symbol.source),
              dataScbApiHead: head,
              dataScbApiSource: symbol.source,
            };
            if (symbol.summary) properties.dataScbApiSummary = symbol.summary;
            const icon = await iconSlug(symbol);
            if (icon) properties.dataScbApiIcon = icon;
            line.addAnnotation(
              new ApiLinkAnnotation(properties, { columnStart: start - lineStart, columnEnd: end - lineStart }),
            );
            taken.push([start, end]);
          }
        }
      },
      async postprocessRenderedBlock({ renderData }) {
        if (!select(`.${cls()}`, renderData.blockAst)) return;
        const figure = select('figure', renderData.blockAst);
        if (!figure) return;
        figure.properties.dataScbApiLinks = '';
        const used = new Set(
          selectAll('a[data-scb-api-icon]', renderData.blockAst).map((a) => a.properties.dataScbApiIcon),
        );
        if (used.size === 0) return;
        const { paths } = await loadIcons();
        // Once for the block, so that each link carries only its slug.
        figure.properties.dataScbApiIcons = JSON.stringify(
          Object.fromEntries([...used].map((slug) => [slug, paths.get(String(slug))])),
        );
      },
    },
  };
}
