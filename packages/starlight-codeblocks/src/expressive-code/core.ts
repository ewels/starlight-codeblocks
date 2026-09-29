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
import {
  type Element,
  type ElementContent,
  EXIT,
  h,
  type Parents,
  select,
  selectAll,
  visit,
} from '@expressive-code/core/hast';
import { bundledLanguagesInfo } from 'shiki/langs';
import { decodeCode, encodeCode } from '../client/shared/copy.ts';
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
      preprocessLanguage({ config }) {
        checkPluginOrder(config.plugins);
      },
      postprocessRenderedLine({ line, renderData }) {
        lineElements.set(line, renderData.lineAst);
      },
      postprocessRenderedBlockGroup({ renderData }) {
        markDecorations(renderData.groupAst);
      },
    },
  };
}

/** The class on every element that a feature adds to a block but that is not code, such as labels and buttons. */
export const DECORATION = `${PREFIX}-deco`;

const decorations = [
  'tools',
  'sr-only',
  'state-label',
  'annotation',
  'annotation-popover',
  'footnote-badge',
  'callout',
  'hidden-marker',
  'expandable-bar',
  'steps-stepper',
  'steps-controls',
  'run-output',
  'permalink',
]
  .map((name) => `.${PREFIX}-${name}`)
  .join(', ');

/**
 * Gives each decoration the one class that tools reading the HTML can drop, such as starlight-llms-txt,
 * and keeps it out of the Pagefind index. Keep the list in step with new decorations.
 */
export function markDecorations(root: Parents) {
  for (const element of selectAll(decorations, root)) {
    const classes = element.properties.className as string[];
    if (!classes.includes(DECORATION)) classes.push(DECORATION);
    element.properties.dataPagefindIgnore = '';
  }
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
 * The lines that line numbers count: the lines that readers see. Own-line directives do not count, even
 * before the notation plugin deletes them.
 */
export function numberedLines(codeBlock: ExpressiveCodeBlock): readonly ExpressiveCodeLine[] {
  const lines = codeBlock.getLines();
  const stored = lineData.getOrCreateFor(codeBlock).lines;
  if (!stored) return lines;
  // Other plugins delete lines after the notation parse, such as the frames plugin's file name comment.
  const current = new Set(lines);
  return stored.filter((line) => current.has(line));
}

/** The number that readers see next to `line`, counted from `startLineNumber`. */
export function lineNumber(codeBlock: ExpressiveCodeBlock, line: ExpressiveCodeLine) {
  return numberedLines(codeBlock).indexOf(line) + (codeBlock.metaOptions.getInteger('startLineNumber') ?? 1);
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

/** Shiki's entry for the language `lang`, by id or alias. */
export const bundledLanguage = (lang: string) =>
  bundledLanguagesInfo.find((info) => info.id === lang || info.aliases?.includes(lang));

/** Shiki's id for the language `lang`, or `lang` itself when Shiki does not know it. */
export const languageId = (lang: string) => bundledLanguage(lang)?.id ?? lang;

/**
 * A relative URL, or one with a scheme in `schemes`, so that no link runs `javascript:`. `URL` strips spaces,
 * tabs and control characters as a browser does, so they cannot hide the scheme.
 */
export function isSafeUrl(href: string, schemes = ['http:', 'https:']) {
  try {
    return schemes.includes(new URL(href, 'https://x.invalid/').protocol);
  } catch {
    return false;
  }
}

/** Adds Astro's `base` to a site-relative URL, unless the URL already starts with it. */
export function withBase(url: string, base = '/') {
  const root = base.replace(/\/$/, '');
  if (!root || !url.startsWith('/') || url.startsWith('//')) return url;
  return url === root || url.startsWith(`${root}/`) ? url : root + url;
}

/** Logs a build warning that names the file, the code block and, if given, the line in the block. */
export function warn({ codeBlock, config }: Context, message: string, line?: number) {
  config.logger.warn(`${where(codeBlock, line)}: ${message}`);
}

/**
 * The block's own value for a site option, from the attribute `key`, such as `lineStates.prefix=false`. `parse` returns
 * `undefined` for a bad value, which warns and keeps `fallback`, the site's value. Without the attribute, `fallback`.
 */
export function blockSetting<T>(
  context: Context,
  key: string,
  parse: (raw: string) => T | undefined,
  fallback: T,
  expected: string,
): T {
  const option = context.codeBlock.metaOptions.list(key).at(-1);
  if (!option) return fallback;
  const value = parse(String(option.value));
  if (value !== undefined) return value;
  warn(context, `\`${option.raw.trim()}\` must be ${expected}. The block uses the site setting.`);
  return fallback;
}

/** Parses `true` or `false`, for `blockSetting()`. */
export const parseBoolean = (raw: string) => (raw === 'true' ? true : raw === 'false' ? false : undefined);

/** Throws a build error that names the file and the code block. */
function fail({ codeBlock }: Context, message: string): never {
  throw new Error(`${where(codeBlock)}: ${message}`);
}

/**
 * Reads a range attribute, such as `focus={4-7}`, and returns its lines, or `undefined` if the
 * attribute is not there. Numbers outside the block give a warning. Anything that is not a range fails the build.
 * Call it in `preprocessCode` or later: the frames plugin removes the file name comment in its `preprocessCode`.
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

const copyButton = (blockAst: Element) =>
  select(`.${PREFIX}-shell-copy[data-code]`, blockAst) ?? select('.copy button[data-code]', blockAst);

/** The text that the copy button copies, which other features can have changed. A shell session gives its commands only. */
export function copiedText(blockAst: Element, code: string) {
  const button = copyButton(blockAst);
  return button ? decodeCode(String(button.properties.dataCode)) : code;
}

/** Keeps the code on the figure for client modules, when a site turns the copy button off. */
export function keepCopiedText(blockAst: Element, code: string) {
  const figure = select('figure', blockAst);
  if (figure && !copyButton(blockAst)) figure.properties.dataScbCode = encodeCode(code);
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

/**
 * The features put decorations among the lines in `postprocessRenderedBlock`, and the collapsible sections
 * plugin later picks its lines out of them by position.
 */
function checkPluginOrder(plugins: readonly { name: string }[]) {
  const ours = plugins.findIndex((plugin) => plugin.name.startsWith('starlight-codeblocks:'));
  const collapsible = plugins.findIndex((plugin) => plugin.name === 'Collapsible sections');
  if (collapsible > ours) {
    throw new Error(
      'Put `pluginCollapsibleSections()` before `pluginCodeblocks()` in the Expressive Code `plugins` list. After it, collapsed sections hold the wrong lines.',
    );
  }
}
