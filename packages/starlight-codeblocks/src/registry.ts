import type { ExpressiveCodePlugin, StyleVariant } from '@expressive-code/core';
import type { ResolvedOptions } from './options.ts';

export interface Registry {
  options: ResolvedOptions;
  /** The real plugin objects, for `<Code>` through the `ec-config` override. */
  plugins: ExpressiveCodePlugin[];
  /** Astro's `base`, which site-relative links in code need. */
  base?: string;
  /** Astro's `build.assets` folder, where the runtime modules go. */
  assets?: string;
  /** Astro's `root` and `cacheDir`, as paths, for API link adapters. */
  root?: string;
  cacheDir?: string;
  /** The site's Expressive Code options that inline highlighting copies: theme selectors and `shiki`. */
  expressiveCode?: Record<string, unknown>;
  /** The `id` of every code block in Markdown, for `linksValidatorExclude()`. */
  blockIds?: Set<string>;
  /** The site engine's themes and resolved style settings, set when it creates its base styles. */
  styleVariants?: StyleVariant[];
}

// A global, because Astro loads the config and renders pages through different module instances.
// Public: other plugins, such as starlight-pydocs, read it by `astro:config:done`, and
// `options.inlineHighlighting` and `options.apiLinks` are truthy when those features are on. Keep all three stable.
const KEY = Symbol.for('starlight-codeblocks');
const store = globalThis as { [KEY]?: Registry };

/** Set by `codeblocks()`, whose integration also emits the client modules as assets. Unset for the bare preset. */
export const getRegistry = () => store[KEY];

export function setRegistry(registry: Registry | undefined) {
  store[KEY] = registry;
}
