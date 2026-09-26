import { createHash } from 'node:crypto';
import { relative } from 'node:path';
import {
  AttachedPluginData,
  type ExpressiveCodeBlock,
  type ExpressiveCodeHookContextBase,
  type ExpressiveCodeLine,
  type ExpressiveCodePlugin,
  ensureColorContrastOnBackground,
  getStaticBackgroundColor,
  InlineStyleAnnotation,
  isInlineStyleAnnotation,
  onBackground,
  type StyleVariant,
} from '@expressive-code/core';
import { type Element, type ElementContent, EXIT, h, type Parents, select, visit } from '@expressive-code/core/hast';
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
    hooks: {
      postprocessRenderedLine({ line, renderData }) {
        lineElements.set(line, renderData.lineAst);
      },
    },
  };
}

const lineElements = new WeakMap<ExpressiveCodeLine, Element>();

/**
 * The rendered element of a line. Look lines up with this, not by their index among `.ec-line` elements:
 * other plugins add lines of their own, such as a collapsed section's summary, or move lines into wrappers.
 */
export const lineElement = (line: ExpressiveCodeLine) => lineElements.get(line);

/** Inserts `nodes` before `target`, wherever it is in `root`. */
export function insertBefore(root: Parents, target: Element, ...nodes: ElementContent[]) {
  visit(
    root,
    (node) => node === target,
    (_, index, parent) => {
      if (parent && index !== undefined) parent.children.splice(index, 0, ...nodes);
      return EXIT;
    },
  );
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

const uids = new WeakMap<ExpressiveCodeBlock, string>();
const uidCounts = new WeakMap<object, Map<string, number>>();

/**
 * A short id for the block, the same in every build: a hash of the block, and a count for identical
 * blocks rendered by the same engine.
 */
export function blockUid({ codeBlock, config }: Context) {
  let uid = uids.get(codeBlock);
  if (uid) return uid;
  const source = `${codeBlock.parentDocument?.sourceFilePath}\0${codeBlock.meta}\0${codeBlock.code}`;
  const hash = createHash('sha1').update(source).digest('hex').slice(0, 8);
  // `config` is a new copy for each render; its `plugins` array belongs to the engine.
  const counts = uidCounts.get(config.plugins) ?? new Map<string, number>();
  uidCounts.set(config.plugins, counts);
  const count = counts.get(hash) ?? 0;
  counts.set(hash, count + 1);
  uid = count ? `${hash}${count}` : hash;
  uids.set(codeBlock, uid);
  return uid;
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

/**
 * A relative, `http:` or `https:` URL, so that no link runs `javascript:`. `URL` strips spaces, tabs and
 * control characters as a browser does, so they cannot hide the scheme.
 */
export function isSafeUrl(href: string) {
  try {
    return ['http:', 'https:'].includes(new URL(href, 'https://x.invalid/').protocol);
  } catch {
    return false;
  }
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
  const figure = select('figure', blockAst);
  if (figure) nameFigure(figure);
}

const controlTags = new Set(['a', 'button', 'input', 'select']);

/**
 * Names the figure after the text of its title bar without the controls. Otherwise the figure takes its
 * name from the whole `figcaption`, controls included.
 */
export function nameFigure(figure: Element) {
  const header = select('.header', figure);
  if (!header) return;
  const text = (node: ElementContent): string =>
    node.type === 'text'
      ? node.value
      : node.type === 'element' && !controlTags.has(node.tagName)
        ? node.children.map(text).join('')
        : '';
  figure.properties.ariaLabel = header.children.map(text).join(' ').replace(/\s+/g, ' ').trim() || 'Code block';
}

/**
 * Adjusts the syntax colours of `line`, or of `range` in it, so that they stay readable on a tint, as
 * Expressive Code does for its own line markers. `tint` gives the layers from the code background up.
 * Call it from `postprocessAnnotations`, so that the result wins over the text markers' own adjustments.
 */
export function ensureTextContrast(
  { styleVariants, config }: Pick<ExpressiveCodeHookContextBase, 'styleVariants' | 'config'>,
  line: ExpressiveCodeLine,
  tint: (variant: StyleVariant) => (string | undefined)[],
  range: { columnStart: number; columnEnd: number } = { columnStart: 0, columnEnd: line.text.length },
) {
  const min = config.minSyntaxHighlightingColorContrast;
  if (min <= 0) return;
  const colours = line.getAnnotations().filter(isInlineStyleAnnotation);
  styleVariants.forEach((variant, styleVariantIndex) => {
    const bg = tint(variant).reduce<string>(
      (under, layer) => (layer ? onBackground(layer, under) : under),
      getStaticBackgroundColor(variant),
    );
    for (const { color, inlineRange, styleVariantIndex: index } of colours) {
      if (!color || !inlineRange || (index !== undefined && index !== styleVariantIndex)) continue;
      const columnStart = Math.max(inlineRange.columnStart, range.columnStart);
      const columnEnd = Math.min(inlineRange.columnEnd, range.columnEnd);
      const readable = ensureColorContrastOnBackground(color, bg, min);
      if (columnStart >= columnEnd || readable.toLowerCase() === color.toLowerCase()) continue;
      line.addAnnotation(
        new InlineStyleAnnotation({
          styleVariantIndex,
          inlineRange: { columnStart, columnEnd },
          color: readable,
          renderPhase: 'earlier',
        }),
      );
    }
  });
}
