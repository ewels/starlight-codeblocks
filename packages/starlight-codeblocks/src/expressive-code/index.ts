import type { ExpressiveCodePlugin } from '@expressive-code/core';
import { type CodeblocksOptions, type ResolvedOptions, resolveOptions } from '../options.ts';
import { getRegistry } from '../registry.ts';
import { pluginAnnotations } from './annotations.ts';
import { pluginBrackets } from './brackets.ts';
import { pluginCallouts } from './callouts.ts';
import { pluginCore } from './core.ts';
import { pluginExpandable } from './expandable.ts';
import { pluginFocus } from './focus.ts';
import { pluginFootnotes } from './footnotes.ts';
import { pluginHiddenLines } from './hidden-lines.ts';
import { pluginLineStates } from './line-states.ts';
import { pluginNotation } from './notation.ts';
import { pluginPermalinks } from './permalinks.ts';
import { pluginPlaceholders } from './placeholders.ts';
import { pluginPlayground } from './playground.ts';
import { pluginShellCopy } from './shell-copy.ts';
import { pluginTokenLinks } from './token-links.ts';
import { pluginWhitespace } from './whitespace.ts';
import { pluginWordDiff } from './word-diff.ts';

export type * from '../options.ts';
export {
  pluginAnnotations,
  pluginBrackets,
  pluginCallouts,
  pluginCore,
  pluginExpandable,
  pluginFocus,
  pluginFootnotes,
  pluginHiddenLines,
  pluginLineStates,
  pluginNotation,
  pluginPermalinks,
  pluginPlaceholders,
  pluginPlayground,
  pluginShellCopy,
  pluginTokenLinks,
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
    ...(options.shellCopy ? [pluginShellCopy(options.shellCopy)] : []),
    ...(options.tokenLinks ? [pluginTokenLinks()] : []),
    ...(options.placeholders ? [pluginPlaceholders(options.placeholders)] : []),
    ...(options.permalinks ? [pluginPermalinks()] : []),
    ...(options.hiddenLines ? [pluginHiddenLines()] : []),
    ...(options.expandable ? [pluginExpandable(options.expandable)] : []),
    // After shell copy, which changes the copied text that the playground gets, and after placeholders.
    ...(options.playgrounds ? [pluginPlayground(options.playgrounds)] : []),
    // After hidden lines, which rebuilds the children of the code element.
    ...(options.callouts ? [pluginCallouts()] : []),
    ...(options.annotations ? [pluginAnnotations()] : []),
    ...(options.footnotes ? [pluginFootnotes(options.footnotes)] : []),
  ];
}
