import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { StarlightPlugin } from '@astrojs/starlight/types';
import type { ExpressiveCodePlugin } from '@expressive-code/core';
import { AstroError } from 'astro/errors';
import { createPlugins, PLUGIN_PREFIX } from './expressive-code/index.ts';
import { codeblocksIntegration } from './integration.ts';
import { type CodeblocksOptions, resolveOptions } from './options.ts';
import { setRegistry } from './registry.ts';
import { INLINE_CSS_ID } from './satteri/inline-code.ts';

export type * from './options.ts';

export default function codeblocks(userOptions: CodeblocksOptions = {}): StarlightPlugin {
  const options = resolveOptions(userOptions);
  return {
    name: 'starlight-codeblocks',
    hooks: {
      async 'config:setup'({ config, updateConfig, addIntegration, astroConfig }) {
        if (config.expressiveCode === false) {
          throw new AstroError(
            'starlight-codeblocks needs Expressive Code, but the Starlight config has `expressiveCode: false`.',
            'Remove `expressiveCode: false` from the Starlight config.',
          );
        }
        const ecConfigUrl = new URL('./ec.config.mjs', astroConfig.root);
        const ecConfigFile = existsSync(ecConfigUrl) ? fileURLToPath(ecConfigUrl) : undefined;
        const ecConfig = ecConfigFile ? (await import(`${ecConfigUrl.href}?t=${Date.now()}`)).default : undefined;
        const ec = typeof config.expressiveCode === 'object' ? config.expressiveCode : {};
        const plugins = createPlugins(options);
        setRegistry({
          options,
          plugins,
          clientAssets: true,
          base: astroConfig.base,
          root: fileURLToPath(astroConfig.root),
          cacheDir: fileURLToPath(astroConfig.cacheDir),
          expressiveCode: { ...ec, ...ecConfig },
        });
        const css = options.inlineHighlighting ? { customCss: [...(config.customCss ?? []), INLINE_CSS_ID] } : {};
        if (Array.isArray(ecConfig?.plugins)) {
          if (!ecConfig.plugins.flat(Infinity).some(isOurs)) {
            throw new AstroError(
              'starlight-codeblocks cannot add its Expressive Code plugins, because `ec.config.mjs` has its own `plugins` list.',
              "Add `pluginCodeblocks()` to `plugins` in `ec.config.mjs`. Import it from 'starlight-codeblocks/expressive-code'.",
            );
          }
          updateConfig(css);
          addIntegration(codeblocksIntegration({ options }));
          return;
        }

        // astro-expressive-code expands every tab to two spaces before any plugin hook runs, in
        // fenced code and in <Code>, which corrupts tab-sensitive examples such as Makefiles and
        // defeats visible whitespace's tab glyph. Leave tabs as written unless the site already
        // chose its own tabWidth. A site with `ec.config.mjs` plugins manages this file itself.
        const tabWidthDefault = ec.tabWidth === undefined ? { tabWidth: 0 } : {};
        updateConfig({
          ...css,
          expressiveCode: {
            ...ec,
            ...tabWidthDefault,
            plugins: [...(ec.plugins ?? []), ...plugins.map(hideFunctions)],
          },
        });
        addIntegration(codeblocksIntegration({ options, ecConfigOverride: { file: ecConfigFile } }));
      },
    },
  };
}

const isOurs = (plugin: unknown) => (plugin as ExpressiveCodePlugin | undefined)?.name?.startsWith(PLUGIN_PREFIX);

/**
 * Astro serialises the Starlight Expressive Code options for `<Code>` and fails on functions.
 * `<Code>` gets the real plugins from the `ec-config` override instead.
 */
function hideFunctions(plugin: ExpressiveCodePlugin): ExpressiveCodePlugin {
  const shell = { name: plugin.name };
  for (const [key, value] of Object.entries(plugin)) {
    if (key !== 'name') Object.defineProperty(shell, key, { value, enumerable: false });
  }
  return shell;
}
