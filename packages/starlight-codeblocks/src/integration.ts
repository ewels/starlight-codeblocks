import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { apiCardPageStyles, CARD_CSS_ID } from './api-card-page.ts';
import { readClientModules } from './client-modules.ts';
import { runtimeFileName, runtimeModules } from './expressive-code/runnable.ts';
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
}

export function codeblocksIntegration({ options, ecConfigOverride }: IntegrationOptions): AstroIntegration {
  return {
    name: 'starlight-codeblocks',
    hooks: {
      'astro:config:setup'({ config, updateConfig, injectScript, logger }) {
        // The shapes `isSatteriProcessor()` and `isUnifiedProcessor()` check, without depending on either package.
        const processor = config.markdown.processor as
          | { name?: string; options?: { mdastPlugins?: unknown[]; remarkPlugins?: unknown[] } }
          | undefined;
        if (processor?.name === 'unified') {
          processor.options?.remarkPlugins?.push(remarkFromSatteri(mdastPlugins(options, logger)));
        } else processor?.options?.mdastPlugins?.push(...mdastPlugins(options, logger));
        const plugins = clientModulePlugins(config.build.assets);
        if (ecConfigOverride) plugins.push(ecConfigPlugin(ecConfigOverride.file));
        if (options.inlineHighlighting) plugins.push(cssPlugin(INLINE_CSS_ID, inlineStyles));
        if (options.apiLinks) {
          plugins.push(cssPlugin(CARD_CSS_ID, apiCardPageStyles));
          const script = apiCardLoader(config.base, config.build.assets);
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

/**
 * Imports the API card module on pages with API links outside code blocks, where the loader in
 * `ec.<hash>.js` is missing. The loader there imports the same URL, so a page with both gets one module.
 */
export function apiCardLoader(base: string, assetsDir: string) {
  const module = readClientModules().find((m) => m.feature === 'api-links');
  if (!module) return undefined;
  const url = `${base.replace(/\/$/, '')}/${assetsDir}/${module.fileName}`;
  // A variable, so that Vite does not try to resolve the URL in dev, which fails the whole page script.
  return `const url = ${JSON.stringify(url)};
const load = () => {
  if (document.querySelector('[data-scb-api-links]')) import(/* @vite-ignore */ url).then((m) => m.default?.());
};
load();
document.addEventListener('astro:page-load', load);`;
}

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
