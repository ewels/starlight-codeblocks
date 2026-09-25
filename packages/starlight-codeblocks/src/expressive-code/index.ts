import type { ExpressiveCodePlugin } from '@expressive-code/core';
import { type CodeblocksOptions, type ResolvedOptions, resolveOptions } from '../options.ts';
import { getRegistry } from '../registry.ts';
import { pluginBrackets } from './brackets.ts';
import { pluginCore } from './core.ts';
import { pluginExpandable } from './expandable.ts';
import { pluginFocus } from './focus.ts';
import { pluginHiddenLines } from './hidden-lines.ts';
import { pluginLineStates } from './line-states.ts';
import { pluginNotation } from './notation.ts';
import { pluginWhitespace } from './whitespace.ts';
import { pluginWordDiff } from './word-diff.ts';

export type * from '../options.ts';
export {
  pluginBrackets,
  pluginCore,
  pluginExpandable,
  pluginFocus,
  pluginHiddenLines,
  pluginLineStates,
  pluginNotation,
  pluginWhitespace,
  pluginWordDiff,
};

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
    ...(options.lineStates ? [pluginLineStates(options.lineStates)] : []),
    ...(options.wordDiff ? [pluginWordDiff(options.wordDiff)] : []),
    ...(options.whitespace ? [pluginWhitespace()] : []),
    ...(options.brackets ? [pluginBrackets(options.brackets)] : []),
    ...(options.hiddenLines ? [pluginHiddenLines()] : []),
    ...(options.expandable ? [pluginExpandable(options.expandable)] : []),
  ];
}
