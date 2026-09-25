import type { AstroIntegration } from 'astro';

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
  /** Replace the `ec.config.mjs` module that `<Code>` reads, so that it gets the real plugins. */
  ecConfigOverride?: { file: string | undefined };
}

export function codeblocksIntegration({ ecConfigOverride }: IntegrationOptions): AstroIntegration {
  return {
    name: 'starlight-codeblocks',
    hooks: {
      'astro:config:setup'({ updateConfig }) {
        const plugins: VitePlugin[] = [];
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
