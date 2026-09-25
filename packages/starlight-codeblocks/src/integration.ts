import type { AstroIntegration } from 'astro';
import { readClientModules } from './client-modules.ts';
import type { ResolvedOptions } from './options.ts';
import { mdastPlugins } from './satteri/index.ts';

type VitePlugin = {
  name: string;
  enforce?: 'pre' | 'post';
  apply?: 'build' | 'serve';
  resolveId?: (id: string) => string | undefined;
  load?: (id: string) => string | undefined;
  buildEnd?: (this: { emitFile(file: { type: 'asset'; fileName: string; source: string }): void }) => void;
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
