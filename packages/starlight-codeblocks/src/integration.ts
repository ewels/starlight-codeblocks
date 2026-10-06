import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ExpressiveCodePlugin } from '@expressive-code/core';
import type { AstroIntegration } from 'astro';
import { AstroError } from 'astro/errors';
import { apiCardPageStyles, CARD_CSS_ID } from './api-card-page.ts';
import { readClientModules } from './client-modules.ts';
import { PLUGIN_PREFIX } from './expressive-code/index.ts';
import { runtimeFileName, runtimeModules } from './expressive-code/runnable.ts';
import { proseSwatchStyles, SWATCH_CSS_ID } from './expressive-code/swatches.ts';
import type { ResolvedOptions } from './options.ts';
import { mdastPlugins } from './satteri/index.ts';
import { INLINE_CSS_ID, inlineStyles } from './satteri/inline-code.ts';
import { remarkFromSatteri } from './satteri/remark.ts';

type EmittedFile =
  | { type: 'asset'; fileName: string; source: string }
  | { type: 'chunk'; id: string; fileName: string; preserveSignature: 'strict' };

type VitePlugin = {
  name: string;
  enforce?: 'pre' | 'post';
  apply?: 'build' | 'serve';
  resolveId?: (this: unknown, id: string) => string | undefined | Promise<string | undefined>;
  load?: (id: string) => string | undefined;
  buildStart?: (this: { environment?: { name: string }; emitFile(file: EmittedFile): void }) => void;
  buildEnd?: (this: { emitFile(file: EmittedFile): void }) => void;
};

const EC_CONFIG = 'virtual:astro-expressive-code/ec-config';
const EC_CONFIG_OVERRIDE = '\0starlight-codeblocks:ec-config';

interface IntegrationOptions {
  options: ResolvedOptions;
  /** Replace the `ec.config.mjs` module that `<Code>` reads, so that it gets the real plugins. */
  ecConfigOverride?: { file: string | undefined };
  /** Style and load API cards on links outside code blocks, such as those of starlight-pydocs. */
  apiCardPage?: boolean;
}

export function codeblocksIntegration({
  options,
  ecConfigOverride,
  apiCardPage = true,
}: IntegrationOptions): AstroIntegration {
  return {
    name: 'starlight-codeblocks',
    hooks: {
      'astro:config:setup'({ command, config, updateConfig, injectScript, logger }) {
        // The shapes `isSatteriProcessor()` and `isUnifiedProcessor()` check, without depending on either package.
        const processor = config.markdown.processor as
          | {
              name?: string;
              options?: { mdastPlugins?: unknown[]; remarkPlugins?: unknown[]; starlightCodeblocks?: string };
            }
          | undefined;
        // The content layer keeps rendered Markdown until its digest of the Astro config changes. That digest
        // skips integrations and functions but covers these options, which both processors otherwise ignore.
        if (processor?.options) processor.options.starlightCodeblocks = optionsDigest(options);
        if (processor?.name === 'unified') {
          processor.options?.remarkPlugins?.push(remarkFromSatteri(mdastPlugins(options, logger)));
        } else processor?.options?.mdastPlugins?.push(...mdastPlugins(options, logger));
        const plugins = clientModulePlugins(config.build.assets);
        if (ecConfigOverride) plugins.push(ecConfigPlugin(ecConfigOverride.file));
        if (options.inlineHighlighting) plugins.push(cssPlugin(INLINE_CSS_ID, inlineStyles));
        // Astro applies `assetsPrefix` only to the build; dev serves the assets under the base.
        const base = (command === 'build' ? jsAssetsPrefix(config.build.assetsPrefix) : undefined) ?? config.base;
        if (options.apiLinks && apiCardPage) {
          plugins.push(cssPlugin(CARD_CSS_ID, apiCardPageStyles));
          const script = apiCardLoader(base, config.build.assets);
          if (script) injectScript('page', script);
        }
        if (options.swatches !== false && options.swatches.prose) {
          const swatches = options.swatches;
          plugins.push(cssPlugin(SWATCH_CSS_ID, () => proseSwatchStyles(swatches)));
          const script = swatches.copy && pageLoader('swatches', base, config.build.assets);
          if (script) injectScript('page', script);
        }
        if (options.runnable) {
          plugins.push(
            ...runtimePlugins(runtimeModules(options.runnable.runtimes, true), config.root, config.build.assets),
          );
        }
        updateConfig({ vite: { plugins: plugins as never } });
      },
    },
  };
}

const optionsDigest = (options: ResolvedOptions) =>
  createHash('sha256')
    .update(JSON.stringify(options, (_, value) => (typeof value === 'function' ? String(value) : value)))
    .digest('base64url')
    .slice(0, 16);

/** The site's `ec.config.mjs`, imported fresh, as Expressive Code does. */
export async function loadEcConfig(root: URL) {
  const url = new URL('./ec.config.mjs', root);
  if (!existsSync(url)) return { file: undefined, config: undefined };
  return { file: fileURLToPath(url), config: (await import(`${url.href}?t=${Date.now()}`)).default };
}

const isOurs = (plugin: unknown) => (plugin as ExpressiveCodePlugin | undefined)?.name?.startsWith(PLUGIN_PREFIX);

/** A `plugins` list in `ec.config.mjs` replaces the one the plugin adds, so it must hold the preset. */
export function checkEcConfigPlugins(plugins: unknown[]) {
  if (plugins.flat(Infinity).some(isOurs)) return;
  throw new AstroError(
    'starlight-codeblocks cannot add its Expressive Code plugins, because `ec.config.mjs` has its own `plugins` list.',
    "Add `pluginCodeblocks()` to `plugins` in `ec.config.mjs`. Import it from 'starlight-codeblocks/expressive-code'.",
  );
}

/** The stylesheets for elements outside code blocks, which every page gets. */
export const pageCssIds = (options: ResolvedOptions, apiCardPage = true) => [
  ...(options.inlineHighlighting ? [INLINE_CSS_ID] : []),
  ...(options.apiLinks && apiCardPage ? [CARD_CSS_ID] : []),
  ...(options.swatches !== false && options.swatches.prose ? [SWATCH_CSS_ID] : []),
];

/**
 * Astro serialises the Expressive Code options for `<Code>` and fails on functions.
 * `<Code>` gets the real plugins from the `ec-config` override instead.
 */
export function hideFunctions(plugin: ExpressiveCodePlugin): ExpressiveCodePlugin {
  const shell = { name: plugin.name };
  for (const [key, value] of Object.entries(plugin)) {
    if (key !== 'name') Object.defineProperty(shell, key, { value, enumerable: false });
  }
  return shell;
}

type Shiki = Record<string, unknown> & { langs?: unknown[]; langAlias?: unknown };

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Merges `shiki` the way astro-expressive-code does, including its fallback to Astro's
 * `markdown.shikiConfig`, so that inline code gets the grammars and aliases that blocks get.
 */
export function mergeEcOptions(
  ec: { shiki?: unknown },
  ecConfig: { shiki?: unknown } = {},
  astroShiki: { langs?: unknown[]; langAlias?: unknown } = {},
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...ec, ...ecConfig };
  const [a, b] = [ec.shiki, ecConfig.shiki];
  if (isObject(a) && isObject(b)) {
    const shiki: Shiki = { ...a };
    for (const [key, value] of Object.entries(b)) {
      const prev = shiki[key];
      if (key === 'langs' && Array.isArray(prev) && Array.isArray(value)) shiki[key] = [...prev, ...value];
      else if (isObject(prev) && isObject(value)) shiki[key] = { ...prev, ...value };
      else shiki[key] = value;
    }
    merged.shiki = shiki;
  }
  if (merged.shiki === false) return merged;
  const shiki: Shiki = isObject(merged.shiki) ? { ...merged.shiki } : {};
  if (!shiki.langs && astroShiki.langs) shiki.langs = astroShiki.langs;
  if (!shiki.langAlias && astroShiki.langAlias) shiki.langAlias = astroShiki.langAlias;
  merged.shiki = shiki;
  return merged;
}

function ecConfigPlugin(file: string | undefined): VitePlugin {
  const user = file ? `import user from ${JSON.stringify(file)};` : 'const user = {};';
  return {
    name: 'starlight-codeblocks:ec-config',
    enforce: 'pre',
    resolveId: (id) => (id === EC_CONFIG ? EC_CONFIG_OVERRIDE : undefined),
    load: (id) =>
      id === EC_CONFIG_OVERRIDE
        ? `${user}
const { plugins } = globalThis[Symbol.for('starlight-codeblocks')];
export default { ...user, plugins: [...(user.plugins ?? []), ...plugins] };`
        : undefined,
  };
}

/** Theme styles for elements outside code blocks. They need the site engine's themes, so they build on first load. */
function cssPlugin(id: string, css: () => string): VitePlugin {
  return {
    name: `starlight-codeblocks:${id}`,
    resolveId: (source) => (source === id ? `\0${id}` : undefined),
    load: (source) => (source === `\0${id}` ? css() : undefined),
  };
}

/** The `build.assetsPrefix` for `.js` files, which can be one string or one per file extension. */
export function jsAssetsPrefix(prefix: string | Record<string, string | undefined> | undefined) {
  return typeof prefix === 'string' ? prefix : (prefix?.js ?? prefix?.fallback);
}

/**
 * Imports the module of `feature` on pages that use it outside code blocks, where the loader in
 * `ec.<hash>.js` is missing. The loader there imports the same URL, so a page with both gets one module.
 */
function pageLoader(feature: string, base: string, assetsDir: string) {
  const module = readClientModules().find((m) => m.feature === feature);
  if (!module) return undefined;
  const url = `${base.replace(/\/$/, '')}/${assetsDir}/${module.fileName}`;
  // A variable, so that Vite does not try to resolve the URL in dev, which fails the whole page script.
  // A block, because Astro joins the page scripts of every loader into one module.
  return `{
  const url = ${JSON.stringify(url)};
  const load = () => {
    if (document.querySelector('[data-scb-${feature}]')) import(/* @vite-ignore */ url).then((m) => m.default?.());
  };
  load();
  document.addEventListener('astro:page-load', load);
}`;
}

/** The loader for API cards on links outside code blocks. */
export const apiCardLoader = (base: string, assetsDir: string) => pageLoader('api-links', base, assetsDir);

/** Serves the feature modules next to `ec.<hash>.js` in dev, and emits them there in the build. */
export function clientModulePlugins(assetsDir: string): VitePlugin[] {
  const files = new Map(readClientModules().map((m) => [`/${assetsDir}/${m.fileName}`, m.source]));
  const prefix = '\0starlight-codeblocks:client:';
  return [
    {
      name: 'starlight-codeblocks:client',
      resolveId(id) {
        const path = id.split('?')[0] as string;
        return files.has(path) ? prefix + path : undefined;
      },
      load: (id) => (id.startsWith(prefix) ? files.get(id.slice(prefix.length)) : undefined),
    },
    {
      name: 'starlight-codeblocks:client-build',
      apply: 'build',
      buildEnd() {
        for (const [path, source] of files) this.emitFile({ type: 'asset', fileName: path.slice(1), source });
      },
    },
  ];
}

/**
 * Bundles each runtime module into its own chunk at a fixed path in the assets folder, where the Run
 * button imports it on the first click. Code blocks render before the client build, so the path
 * cannot carry a hash.
 */
export function runtimePlugins(runtimes: Record<string, string>, root: URL, assetsDir: string): VitePlugin[] {
  const specifier = (s: string) => (s.startsWith('.') ? fileURLToPath(new URL(s, root)) : s);
  const files = new Map(
    Object.entries(runtimes).map(([language, s]) => [`/${assetsDir}/${runtimeFileName(language)}`, specifier(s)]),
  );
  return [
    {
      name: 'starlight-codeblocks:runtimes',
      async resolveId(id) {
        const file = files.get(id.split('?')[0] as string);
        const context = this as { resolve(id: string): Promise<{ id: string } | null> };
        return file ? (await context.resolve(file))?.id : undefined;
      },
    },
    {
      name: 'starlight-codeblocks:runtimes-build',
      apply: 'build',
      buildStart() {
        if (this.environment?.name !== 'client') return;
        for (const [path, id] of files) {
          this.emitFile({ type: 'chunk', id, fileName: path.slice(1), preserveSignature: 'strict' });
        }
      },
    },
  ];
}
