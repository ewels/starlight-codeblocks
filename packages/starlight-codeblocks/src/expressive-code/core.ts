import { relative } from 'node:path';
import {
  AttachedPluginData,
  type ExpressiveCodeBlock,
  type ExpressiveCodeHookContextBase,
  type ExpressiveCodeLine,
  type ExpressiveCodePlugin,
} from '@expressive-code/core';
import { type Element, h, select } from '@expressive-code/core/hast';
import { getRegistry } from '../registry.ts';
import type { DirectiveSpecs } from './notation.ts';
import { parseRange, RangeSyntaxError } from './ranges.ts';
import { baseStyles, PREFIX, styleSettings } from './styles.ts';

/** An Expressive Code plugin that can declare directives for the notation plugin. */
export interface CodeblocksPlugin extends ExpressiveCodePlugin {
  directives?: DirectiveSpecs;
}

/** Shared parts that every feature needs: style settings and base styles. The preset adds it first. */
export function pluginCore(): CodeblocksPlugin {
  return {
    name: 'starlight-codeblocks:core',
    styleSettings,
    baseStyles(context) {
      const registry = getRegistry();
      if (registry) registry.styleVariants = context.styleVariants;
      return baseStyles(context);
    },
  };
}

type Context = Pick<ExpressiveCodeHookContextBase, 'codeBlock' | 'config'>;

export const lineData = new AttachedPluginData<{ lines?: readonly ExpressiveCodeLine[] }>(() => ({}));

/**
 * The lines that line numbers count: the lines that readers see, before other plugins remove any.
 * Own-line directives do not count.
 */
export function numberedLines(codeBlock: ExpressiveCodeBlock): readonly ExpressiveCodeLine[] {
  return lineData.getOrCreateFor(codeBlock).lines ?? codeBlock.getLines();
}

function where(codeBlock: ExpressiveCodeBlock, line?: number) {
  const file = codeBlock.parentDocument?.sourceFilePath;
  const title = codeBlock.metaOptions.getString('title');
  return [
    file ? relative(process.cwd(), file) : 'unknown file',
    `${codeBlock.language || 'plain text'} code block${title ? ` "${title}"` : ''}`,
    ...(line === undefined ? [] : [`line ${line}`]),
  ].join(', ');
}

/** Logs a build warning that names the file, the code block and, if given, the line in the block. */
export function warn({ codeBlock, config }: Context, message: string, line?: number) {
  config.logger.warn(`${where(codeBlock, line)}: ${message}`);
}

/** Throws a build error that names the file and the code block. */
export function fail({ codeBlock }: Context, message: string): never {
  throw new Error(`${where(codeBlock)}: ${message}`);
}

/**
 * Reads a range attribute, such as `focus={4-7}`, and returns its lines, or `undefined` if the
 * attribute is not there. Numbers outside the block give a warning. Anything that is not a range fails the build.
 */
export function resolveRange(context: Context, key: string): ExpressiveCodeLine[] | undefined {
  const option = context.codeBlock.metaOptions.list(key).at(-1);
  if (!option) return undefined;
  if (option.kind !== 'range' && option.kind !== 'string') {
    fail(context, `\`${option.raw}\` needs a range, such as \`${key}={1, 4-6}\`.`);
  }
  let numbers: number[];
  try {
    numbers = parseRange(String(option.value));
  } catch (error) {
    if (error instanceof RangeSyntaxError) fail(context, `\`${option.raw}\` is not a valid range: ${error.reason}.`);
    throw error;
  }
  const lines = numberedLines(context.codeBlock);
  const outside = numbers.filter((n) => n > lines.length);
  if (outside.length > 0) {
    warn(
      context,
      `\`${option.raw}\` names line ${outside.join(', ')}, but the block has ${lines.length} lines. The plugin ignores ${outside.length > 1 ? 'them' : 'it'}.`,
    );
  }
  return numbers.flatMap((n) => lines[n - 1] ?? []);
}

/** Adds a control, such as an `scb-btn` button, to the group of controls at the end of the title bar. */
export function addTitleBarControl(blockAst: Element, control: Element) {
  const header = select('.header', blockAst);
  if (!header) return;
  let tools = select(`.${PREFIX}-tools`, header);
  if (!tools) {
    tools = h('span', { class: `${PREFIX}-tools` });
    header.children.push(tools);
  }
  tools.children.push(control);
}
