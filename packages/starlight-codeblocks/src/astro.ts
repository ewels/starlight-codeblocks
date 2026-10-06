import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { AstroError } from 'astro/errors';
import astroExpressiveCode, { type AstroExpressiveCodeOptions } from 'astro-expressive-code';
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
import { setRegistry } from './registry.ts';
import { restoreDirectives } from './satteri/index.ts';

export type * from './options.ts';

type SatteriProcessor = {
  name: string;
  options: { features?: { directive?: boolean }; mdastPlugins?: unknown[] };
};

export interface AstroCodeblocksOptions extends CodeblocksOptions {
  /** The options of `astro-expressive-code`, which `codeblocks()` adds to the site. */
  expressiveCode?: AstroExpressiveCodeOptions;
}

/**
 * `codeblocks()` for Astro sites without Starlight. It adds Expressive Code with the plugins, so it
 * takes the place of `expressiveCode()` in `integrations`, before `mdx()`. Code tabs and inline code
 * highlighting change every Markdown page, so they start only when the site turns them on.
 */
export default function codeblocks({
  expressiveCode: ec = {},
  ...userOptions
}: AstroCodeblocksOptions = {}): AstroIntegration[] {
  const options = resolveOptions({ codeTabs: false, inlineHighlighting: false, ...userOptions });
  const plugins = createPlugins(options);
  const setup: AstroIntegration = {
    name: 'starlight-codeblocks',
    hooks: {
      async 'astro:config:setup'(params) {
        const { config, injectScript } = params;
        const names = config.integrations.map((integration) => integration.name);
        if (names.filter((name) => name === 'astro-expressive-code').length > 1) {
          throw new AstroError(
            'starlight-codeblocks adds Expressive Code to the site, but `integrations` has `expressiveCode()` as well.',
            'Remove `expressiveCode()` from `integrations`. Give its options to `codeblocks({ expressiveCode: { … } })`, or keep them in `ec.config.mjs`.',
          );
        }
        const mdx = names.indexOf('@astrojs/mdx');
        if (mdx > -1 && mdx < names.indexOf('starlight-codeblocks')) {
          throw new AstroError(
            'starlight-codeblocks must come before `mdx()` in `integrations`, so that code blocks in MDX pages get its features.',
            'Move `codeblocks()` before `mdx()` in `integrations`.',
          );
        }
        const { file, config: ecConfig } = await loadEcConfig(config.root);
        const ownPlugins = Array.isArray(ecConfig?.plugins);
        if (ownPlugins) checkEcConfigPlugins(ecConfig.plugins);
        setRegistry({
          options,
          plugins,
          base: config.base,
          assets: config.build.assets,
          root: fileURLToPath(config.root),
          cacheDir: fileURLToPath(config.cacheDir),
          // Without Starlight, Expressive Code names each theme in its `data-theme` selector.
          expressiveCode: {
            useStarlightDarkModeSwitch: false,
            ...mergeEcOptions(ec, ecConfig, config.markdown?.shikiConfig),
          },
          blockIds: new Set(),
        });
        for (const id of pageCssIds(options, false)) injectScript('page-ssr', `import ${JSON.stringify(id)};`);
        const integration = codeblocksIntegration({
          options,
          ecConfigOverride: ownPlugins ? undefined : { file },
          apiCardPage: false,
        });
        await integration.hooks['astro:config:setup']?.(params);
      },
      // Last, after every integration has added its plugins, so that only directives nobody claims go back to text.
      'astro:config:done'({ config }) {
        const processor = config.markdown.processor as SatteriProcessor | undefined;
        if (!options.codeTabs || processor?.name !== 'satteri' || processor.options.features?.directive) return;
        processor.options.features = { ...processor.options.features, directive: true };
        processor.options.mdastPlugins?.push(restoreDirectives());
      },
    },
  };
  return [
    setup,
    // `ec.config.mjs` overrides these, as it does any `expressiveCode()` option.
    astroExpressiveCode({ tabWidth: 0, ...ec, plugins: [...(ec.plugins ?? []), ...plugins.map(hideFunctions)] }),
  ];
}
