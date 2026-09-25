import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  type AnnotationRenderOptions,
  AttachedPluginData,
  ExpressiveCodeAnnotation,
  type ExpressiveCodeHookContextBase,
  PluginStyleSettings,
  type UnresolvedStyleValue,
} from '@expressive-code/core';
import { h, select } from '@expressive-code/core/hast';
import { clientJsModules } from '../client-modules.ts';
import type { AdapterContext, ApiLinkAdapter, Resolution } from '../options.ts';
import { getRegistry } from '../registry.ts';
import type { CodeblocksPlugin } from './core.ts';
import { getDirectives } from './notation.ts';
import { PREFIX } from './styles.ts';
import { withBase } from './token-links.ts';

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
      underline: ['#7f8aa0', '#7d8696'],
      hoverUnderline: ({ resolveSetting }) => resolveSetting('codeblocks.accent'),
      hoverBackground: ({ resolveSetting }) =>
        `color-mix(in srgb, ${resolveSetting('codeblocks.accent')} 12%, transparent)`,
    },
  },
});

const cls = (suffix = '') => `${PREFIX}-api-link${suffix}`;

const blockData = new AttachedPluginData<{ linked: boolean }>(() => ({ linked: false }));

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
 * ponytail: no expiry; delete the folder to fetch again.
 */
export async function cachedFetch(url: string, dir: string, warn: (message: string) => void) {
  const file = join(dir, createHash('sha256').update(url).digest('hex').slice(0, 24));
  try {
    return new Uint8Array(await readFile(file));
  } catch {}
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = new Uint8Array(await response.arrayBuffer());
    await mkdir(dir, { recursive: true });
    const partial = `${file}.${process.pid}.part`;
    await writeFile(partial, body);
    await rename(partial, file);
    return body;
  } catch (error) {
    warn(
      `could not fetch ${url} (${error instanceof Error ? error.message : error}). Names from it stay plain text in this build.`,
    );
    return null;
  }
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
      fetch: (url) => cachedFetch(url, fetchCacheDir(root), warn),
      warn,
    };
    setup = adapter.setup(context).then(
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

// Inventories and dumps are outside the site's control, so they must not add `javascript:` links.
const isSafe = (href: string) => !/^[a-z][a-z0-9+.-]*:/i.test(href) || /^https?:/i.test(href);

/** The line at the top of the card: the signature, or the kind and qualified name. */
export const cardHead = (resolution: Resolution, name: string) =>
  resolution.signature ?? [resolution.kind, resolution.name ?? name].filter(Boolean).join(' ');

const sentences = (...parts: (string | undefined)[]) =>
  parts
    .filter(Boolean)
    .map((part) => (/[.!?]$/.test(part as string) ? part : `${part}.`))
    .join(' ');

/** Links names in code to their reference pages through language adapters, with a hover card. */
export function pluginApiLinks({ adapters }: { adapters: ApiLinkAdapter[] }): CodeblocksPlugin {
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
.${PREFIX}-api-card {
  width: max-content;
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
}`,
    hooks: {
      async annotateCode(context) {
        const { codeBlock } = context;
        if (codeBlock.metaOptions.getBoolean('apiLinks') === false) return;
        const active = adapters.filter((adapter) => adapter.languages.includes(codeBlock.language));
        if (active.length === 0) return;
        const root = getRegistry()?.base;
        const lines = codeBlock.getLines();
        const tokenLinked = new Set(getDirectives(codeBlock, 'link').flatMap((d) => d.lines));
        const starts: number[] = [];
        let offset = 0;
        for (const line of lines) {
          starts.push(offset);
          offset += line.text.length + 1;
        }
        const code = lines.map((line) => line.text).join('\n');
        const taken: [number, number][] = [];
        for (const adapter of active) {
          if (!(await ready(adapter, context))) continue;
          for (const symbol of adapter.findSymbols(code, codeBlock.language)) {
            const { start, end } = symbol;
            if (end <= start || taken.some(([s, e]) => start < e && end > s)) continue;
            const index = starts.findLastIndex((s) => s <= start);
            const line = lines[index];
            const lineStart = starts[index] ?? 0;
            if (!line || tokenLinked.has(line) || end > lineStart + line.text.length) continue;
            const resolution = adapter.resolve(symbol);
            if (!resolution || !isSafe(resolution.href)) continue;
            const head = cardHead(resolution, symbol.name);
            const properties: Record<string, string> = {
              class: cls(),
              href: withBase(resolution.href, root),
              'aria-description': sentences(head, resolution.summary, resolution.source),
              dataScbApiHead: head,
              dataScbApiSource: resolution.source,
            };
            if (resolution.summary) properties.dataScbApiSummary = resolution.summary;
            line.addAnnotation(
              new ApiLinkAnnotation(properties, { columnStart: start - lineStart, columnEnd: end - lineStart }),
            );
            taken.push([start, end]);
            blockData.getOrCreateFor(codeBlock).linked = true;
          }
        }
      },
      postprocessRenderedBlock({ codeBlock, renderData }) {
        if (!blockData.getOrCreateFor(codeBlock).linked) return;
        const figure = select('figure', renderData.blockAst);
        if (figure) figure.properties.dataScbApiLinks = '';
      },
    },
  };
}
