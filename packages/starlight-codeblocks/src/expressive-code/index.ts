import type { ExpressiveCodePlugin } from '@expressive-code/core';
import { type CodeblocksOptions, type ResolvedOptions, resolveOptions } from '../options.ts';
import { getRegistry } from '../registry.ts';
import { pluginCore } from './core.ts';
import { pluginFocus } from './focus.ts';
import { pluginNotation } from './notation.ts';

export type * from '../options.ts';
export { pluginCore, pluginFocus, pluginNotation };

/** Plugin names start with this, so `codeblocks()` can find its plugins in `ec.config.mjs`. */
export const PLUGIN_PREFIX = 'starlight-codeblocks:';

/**
 * Every feature as Expressive Code plugins. With no argument on a Starlight site,
 * it uses the options given to `codeblocks()`.
 */
export function pluginCodeblocks(options?: CodeblocksOptions): ExpressiveCodePlugin[] {
  const resolved = options ? resolveOptions(options) : (getRegistry()?.options ?? resolveOptions());
  return createPlugins(resolved);
}

/** The core plugin comes first, then notation, so that features can read the directives. */
export function createPlugins(options: ResolvedOptions): ExpressiveCodePlugin[] {
  return [
    pluginCore(),
    ...(options.notation ? [pluginNotation(options.notation)] : []),
    ...(options.focus ? [pluginFocus(options.focus)] : []),
  ];
}
