import type { ExpressiveCodePlugin } from '@expressive-code/core';
import { type CodeblocksOptions, type ResolvedOptions, resolveOptions } from '../options.ts';
import { getRegistry } from '../registry.ts';
import { pluginAnnotations } from './annotations.ts';
import { pluginApiLinks } from './api-links.ts';
import { pluginBrackets } from './brackets.ts';
import { pluginCallouts } from './callouts.ts';
import { pluginCodeLinks } from './code-links.ts';
import { pluginCodeSwitcher } from './code-switcher.ts';
import { pluginCore } from './core.ts';
import { pluginExpandable } from './expandable.ts';
import { pluginFocus } from './focus.ts';
import { pluginFootnotes } from './footnotes.ts';
import { pluginHiddenLines } from './hidden-lines.ts';
import { pluginLineStates } from './line-states.ts';
import { pluginMentions } from './mentions.ts';
import { pluginNotation } from './notation.ts';
import { pluginPermalinks } from './permalinks.ts';
import { pluginPlaceholders } from './placeholders.ts';
import { pluginPlayground } from './playground.ts';
import { pluginRunnable } from './runnable.ts';
import { pluginShellCopy } from './shell-copy.ts';
import { pluginWalkthrough } from './walkthrough.ts';
import { pluginWhitespace } from './whitespace.ts';
import { pluginWordDiff } from './word-diff.ts';

export type * from '../options.ts';
export {
  pluginAnnotations,
  pluginApiLinks,
  pluginBrackets,
  pluginCallouts,
  pluginCodeLinks,
  pluginCodeSwitcher,
  pluginCore,
  pluginExpandable,
  pluginFocus,
  pluginFootnotes,
  pluginHiddenLines,
  pluginLineStates,
  pluginMentions,
  pluginNotation,
  pluginPermalinks,
  pluginPlaceholders,
  pluginPlayground,
  pluginRunnable,
  pluginShellCopy,
  pluginWalkthrough,
  pluginWhitespace,
  pluginWordDiff,
};

/** Plugin names start with this, so `codeblocks()` can find its plugins in `ec.config.mjs`. */
export const PLUGIN_PREFIX = 'starlight-codeblocks:';

/**
 * Every feature as Expressive Code plugins. With no options on a Starlight site,
 * it uses the options given to `codeblocks()`. `base` is Astro's `base`, for site-relative links in code,
 * and defaults to the one `codeblocks()` found.
 */
export function pluginCodeblocks(
  options?: CodeblocksOptions,
  { base }: { base?: string } = {},
): ExpressiveCodePlugin[] {
  const resolved = options ? resolveOptions(options) : (getRegistry()?.options ?? resolveOptions());
  return createPlugins(resolved, base);
}

/** The core plugin comes first, then notation, so that features can read the directives. */
export function createPlugins(options: ResolvedOptions, base?: string): ExpressiveCodePlugin[] {
  return [
    pluginCore(),
    ...(options.notation ? [pluginNotation(options.notation)] : []),
    pluginFocus(options.focus || { stylesOnly: true }),
    ...(options.lineStates ? [pluginLineStates(options.lineStates)] : []),
    ...(options.wordDiff ? [pluginWordDiff(options.wordDiff)] : []),
    ...(options.whitespace ? [pluginWhitespace()] : []),
    ...(options.brackets
      ? [pluginBrackets({ ...options.brackets, comments: options.notation ? options.notation.comments : {} })]
      : []),
    ...(options.shellCopy ? [pluginShellCopy(options.shellCopy)] : []),
    ...(options.codeLinks ? [pluginCodeLinks({ base })] : []),
    ...(options.apiLinks ? [pluginApiLinks({ ...options.apiLinks, base })] : []),
    ...(options.placeholders ? [pluginPlaceholders(options.placeholders)] : []),
    ...(options.mentions ? [pluginMentions()] : []),
    ...(options.permalinks ? [pluginPermalinks()] : []),
    ...(options.hiddenLines ? [pluginHiddenLines()] : []),
    ...(options.expandable ? [pluginExpandable(options.expandable)] : []),
    // After shell copy, which changes the copied text that the playground gets, and after placeholders.
    ...(options.playgrounds ? [pluginPlayground(options.playgrounds)] : []),
    ...(options.runnable ? [pluginRunnable(options.runnable)] : []),
    ...(options.codeSwitcher ? [pluginCodeSwitcher()] : []),
    // Also with the walkthrough off: the step label is how a block names its step without the stepper.
    pluginWalkthrough(),
    // After hidden lines, so that a callout sits between a hidden lines marker and its line.
    ...(options.callouts ? [pluginCallouts()] : []),
    ...(options.annotations ? [pluginAnnotations(options.annotations)] : []),
    ...(options.footnotes ? [pluginFootnotes(options.footnotes)] : []),
  ];
}
