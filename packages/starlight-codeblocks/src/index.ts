import { fileURLToPath } from 'node:url';
import type { StarlightPlugin } from '@astrojs/starlight/types';
import { AstroError } from 'astro/errors';
import { createPlugins } from './expressive-code/index.ts';
import {
  checkEcConfigPlugins,
  codeblocksIntegration,
  hideFunctions,
  loadEcConfig,
  mergeEcOptions,
  pageCssIds,
} from './integration.ts';
import { type CodeblocksOptions, resolveOptions } from './options.ts';
import { getRegistry, setRegistry } from './registry.ts';

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
            'Remove `expressiveCode: false` from the Starlight config. A plugin listed before starlight-codeblocks, such as starlight-theme-nova, can also turn Expressive Code off: list `codeblocks()` before that plugin, or set `expressiveCode: {}` in the Starlight config.',
          );
        }
        const { file: ecConfigFile, config: ecConfig } = await loadEcConfig(astroConfig.root);
        const ec = typeof config.expressiveCode === 'object' ? config.expressiveCode : {};
        const plugins = createPlugins(options);
        setRegistry({
          options,
          plugins,
          base: astroConfig.base,
          assets: astroConfig.build?.assets,
          root: fileURLToPath(astroConfig.root),
          cacheDir: fileURLToPath(astroConfig.cacheDir),
          expressiveCode: mergeEcOptions(ec, ecConfig, astroConfig.markdown?.shikiConfig),
          blockIds: new Set(),
        });
        const pageCss = pageCssIds(options);
        const css = pageCss.length > 0 ? { customCss: [...(config.customCss ?? []), ...pageCss] } : {};
        // astro-expressive-code expands tabs to two spaces before any plugin hook runs, which breaks
        // tab-sensitive code such as Makefiles, so keep tabs unless the site chose a `tabWidth`.
        const keepTabs = ec.tabWidth === undefined && ecConfig?.tabWidth === undefined;
        if (Array.isArray(ecConfig?.plugins)) {
          checkEcConfigPlugins(ecConfig.plugins);
          updateConfig({ ...css, ...(keepTabs && { expressiveCode: { ...ec, tabWidth: 0 } }) });
          addIntegration(codeblocksIntegration({ options }));
          return;
        }

        updateConfig({
          ...css,
          expressiveCode: {
            ...ec,
            ...(keepTabs && { tabWidth: 0 }),
            plugins: [...(ec.plugins ?? []), ...plugins.map(hideFunctions)],
          },
        });
        addIntegration(codeblocksIntegration({ options, ecConfigOverride: { file: ecConfigFile } }));
      },
    },
  };
}

/**
 * An `exclude` function for starlight-links-validator. It skips links to code mentions and to lines of
 * code blocks with an `id`, which the validator cannot see because they exist only in rendered code.
 */
export function linksValidatorExclude({ link }: { link: string }): boolean {
  const at = link.indexOf('#');
  if (at < 0) return false;
  const hash = link.slice(at + 1);
  if (hash.startsWith('mention:')) return true;
  return getRegistry()?.blockIds?.has(hash.replace(/-L\d+(?:-L\d+)?$/, '')) ?? false;
}
