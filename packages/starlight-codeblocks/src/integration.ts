import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { readClientModules } from './client-modules.ts';
import { runtimeFileName, runtimeModules } from './expressive-code/runnable.ts';
import type { ResolvedOptions } from './options.ts';
import { mdastPlugins } from './satteri/index.ts';
import { INLINE_CSS_ID, inlineStyles } from './satteri/inline-code.ts';

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
      'astro:config:setup'({ config, updateConfig, logger }) {
        // The shape `isSatteriProcessor()` checks, without a dependency on @astrojs/markdown-satteri.
        const processor = config.markdown.processor as { options?: { mdastPlugins?: unknown[] } } | undefined;
        processor?.options?.mdastPlugins?.push(...mdastPlugins(options, logger));
        const plugins = clientModulePlugins(config.build.assets);
        if (ecConfigOverride) plugins.push(ecConfigPlugin(ecConfigOverride.file));
        if (options.inlineHighlighting) plugins.push(inlineCssPlugin());
        if (options.runnable) {
          plugins.push(...runtimePlugins(runtimeModules(options.runnable.runtimes), config.root, config.build.assets));
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

/** The inline code theme styles. They need the site engine's themes, so they build on first load. */
function inlineCssPlugin(): VitePlugin {
  return {
    name: 'starlight-codeblocks:inline-css',
    resolveId: (id) => (id === INLINE_CSS_ID ? `\0${INLINE_CSS_ID}` : undefined),
    load: (id) => (id === `\0${INLINE_CSS_ID}` ? inlineStyles() : undefined),
  };
}

/** Serves the feature modules next to `ec.<hash>.js` in dev, and emits them there in the build. */
export function clientModulePlugins(assetsDir: string): VitePlugin[] {
  const files = new Map(readClientModules().map((m) => [`/${assetsDir}/${m.fileName}`, m.source]));
  const prefix = '\0starlight-codeblocks:client:';
  return [
    {
      name: 'starlight-codeblocks:client',
      resolveId: (id) => (files.has(id.split('?')[0] as string) ? prefix + id.split('?')[0] : undefined),
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
