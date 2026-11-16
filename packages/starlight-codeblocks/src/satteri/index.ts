import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MetaOptions } from '@expressive-code/core';
import type { Code, InlineCode, Link, Nodes, Text } from 'mdast';
import type {
  MdastNode,
  MdastPluginDefinition,
  MdastPluginEntry,
  MdastVisitorContext,
  PluginFactoryContext,
} from 'satteri';
import { encodeVariant, TABS_META, type TabsVariant } from '../expressive-code/code-tabs.ts';
import { commentSyntaxFor } from '../expressive-code/comments.ts';
import { bundledLanguage } from '../expressive-code/core.ts';
import { parseNotation } from '../expressive-code/notation.ts';
import { findColours, SWATCH, type SwatchSettings, swatchTexts, wholeColour } from '../expressive-code/swatches.ts';
import { withTrailingWhitespace } from '../expressive-code/whitespace.ts';
import { type CodeblocksOptions, type ResolvedOptions, resolveOptions } from '../options.ts';
import { getRegistry } from '../registry.ts';
import { type Say, uiTexts } from '../translations.ts';
import { inlineCode } from './inline-code.ts';

type ContainerDirective = Parameters<NonNullable<MdastPluginDefinition['containerDirective']>>[0];

export interface Logger {
  warn(message: string): void;
}

/** Visits every node of the tree in document order. */
function walk(node: Nodes, visit: (node: Nodes) => void) {
  visit(node);
  if ('children' in node) for (const child of node.children) walk(child as Nodes, visit);
}

const fileName = (url: URL | undefined) => (url ? relative(process.cwd(), fileURLToPath(url)) : 'unknown file');

function checkIds(codes: Code[], warn: Logger['warn']) {
  const seen = new Set<string>();
  for (const code of codes) {
    const id = new MetaOptions(code.meta ?? '').getString('id');
    if (!id) continue;
    if (seen.has(id)) {
      warn(`two code blocks have \`id="${id}"\`. Line permalinks need a different id for each block.`);
    }
    seen.add(id);
  }
}

const MENTION = '#mention:';

/** The language Expressive Code renders a fence as: `diff lang="py"` renders as Python. */
const fenceLanguage = (code: Code) =>
  (code.lang === 'diff' && new MetaOptions(code.meta ?? '').getString('lang')) || code.lang;

/** The names that the mentions plugin tags in `code`, read with the same parser. */
function mentionNames(code: Code, notation: ResolvedOptions['notation']) {
  if (!notation || !/\[\\?!/.test(code.value)) return new Set<string>();
  const syntaxes = commentSyntaxFor(fenceLanguage(code) ?? '', notation.comments);
  const parsed = parseNotation(code.value.split('\n'), syntaxes, { mention: {} }, () => {});
  return new Set(parsed.flatMap((line) => line.directives.flatMap((d) => d.args.slice(0, 1))));
}

type Event = { section: number } & ({ link: Link; name: string } | { names: Set<string> });

/**
 * A mention link pairs with the next block in its section that tags the name, or else with any block before it.
 * A link with neither becomes plain text.
 */
function checkMentions(events: Event[], ctx: MdastVisitorContext, warn: Logger['warn']) {
  events.forEach((event, i) => {
    if (!('link' in event)) return;
    const tags = (e: Event) => 'names' in e && e.names.has(event.name);
    const later = events.slice(i + 1).some((e) => e.section === event.section && tags(e));
    if (later || events.slice(0, i).some(tags)) return;
    warn(
      `the link to \`${MENTION}${event.name}\` has no code block with \`[!mention ${event.name}]\` in its section or before it. It shows as plain text.`,
    );
    ctx.replaceNode(event.link, [...event.link.children]);
  });
}

function languageName(lang: string | null | undefined, say: Say) {
  if (!lang) return say('codeTabs.plainText');
  return bundledLanguage(lang)?.name ?? lang;
}

/** Turns `:::code-tabs{sync="…" control="…"}` into a wrapper whose code blocks each carry their variant. */
function codeTabs(node: ContainerDirective, file: string, fallback: TabsVariant['control'], say: Say): MdastNode {
  const codes = node.children;
  if (codes.length === 0 || codes.some((child) => child.type !== 'code')) {
    throw new Error(`${file}: \`:::code-tabs\` can contain only fenced code blocks, and needs at least one.`);
  }
  const labels = (codes as Code[]).map(
    (code) => new MetaOptions(code.meta ?? '').getString('label') ?? languageName(fenceLanguage(code), say),
  );
  const repeated = labels.find((label, i) => labels.indexOf(label) !== i);
  if (repeated !== undefined) {
    throw new Error(
      `${file}: two variants in a \`:::code-tabs\` have the label "${repeated}". Give each variant a different \`label="…"\`.`,
    );
  }
  const control = node.attributes?.control ?? fallback;
  if (control !== 'tabs' && control !== 'menu') {
    throw new Error(
      `${file}: \`:::code-tabs\` has \`control="${control}"\`. Use \`control="tabs"\` or \`control="menu"\`.`,
    );
  }
  return {
    type: 'paragraph',
    data: {
      hName: 'div',
      hProperties: {
        className: ['scb-tabs'],
        dataScbCodeTabs: node.attributes?.sync ?? '',
        dataScbControl: control,
        dataScbLabels: JSON.stringify(labels),
        dataScbTexts: JSON.stringify({ variant: say('codeTabs.variant') }),
      },
    },
    children: (codes as Code[]).map((code, index) => ({
      ...code,
      meta: `${code.meta ?? ''} ${TABS_META}="${encodeVariant({ index, labels, control })}"`.trim(),
    })),
  } as unknown as MdastNode;
}

const swatchHast = (colour: string, texts: string | undefined) => ({
  className: [`${SWATCH}-text`],
  dataScbColour: colour,
  ...(texts && { dataScbSwatches: texts }),
  style: `--scb-swatch: ${colour}`,
});
const chipHast = { className: [SWATCH], ariaHidden: 'true' };

/** The text with a swatch before each colour, or `undefined` when it has none. */
function proseSwatches(node: Text, { formats }: SwatchSettings, texts: string | undefined) {
  const matches = findColours(node.value, 'prose', formats);
  if (matches.length === 0) return;
  const nodes: unknown[] = [];
  let at = 0;
  for (const { start, end, colour } of matches) {
    if (start > at) nodes.push({ type: 'text', value: node.value.slice(at, start) });
    nodes.push({
      type: 'scbSwatch',
      data: { hName: 'span', hProperties: swatchHast(colour, texts) },
      children: [
        { type: 'scbSwatchChip', data: { hName: 'span', hProperties: chipHast }, children: [] },
        { type: 'text', value: colour },
      ],
    });
    at = end;
  }
  if (at < node.value.length) nodes.push({ type: 'text', value: node.value.slice(at) });
  return nodes;
}

/** Inline code that is one colour, as a `code` element with a swatch inside. */
function inlineSwatch(node: InlineCode, { formats }: SwatchSettings, texts: string | undefined) {
  const colour = wholeColour(node.value, formats);
  if (!colour) return;
  const chip = { type: 'element', tagName: 'span', properties: chipHast, children: [] };
  const text = { type: 'text', value: node.value };
  return {
    type: 'inlineCode',
    value: node.value,
    data: {
      hName: 'code',
      hChildren: [{ type: 'element', tagName: 'span', properties: swatchHast(colour, texts), children: [chip, text] }],
    },
  } as InlineCode;
}

const PREFIX = 'starlight-codeblocks:';
export const MARKDOWN_GROUP = `${PREFIX}markdown`;
const consoleLogger: Logger = { warn: (message) => console.warn(`[starlight-codeblocks] ${message}`) };

/** One option, resolved with its defaults and checked as `codeblocks()` checks it. */
const resolve = <K extends keyof CodeblocksOptions>(key: K, value: CodeblocksOptions[K]) =>
  resolveOptions({ [key]: value })[key];

/** What a plugin needs for one document: its file, warnings that name the file, and the texts of its language. */
function page({ fileURL }: PluginFactoryContext, logger: Logger) {
  const file = fileName(fileURL);
  return {
    file,
    fileURL,
    warn: (message: string) => logger.warn(`${file}: ${message}`),
    say: uiTexts(getRegistry()?.pageLang?.(fileURL ? fileURLToPath(fileURL) : '') ?? 'en'),
  };
}

/**
 * A factory, so that each document gets its own state, with the plugin name as the function name,
 * so that `codeblocks()` finds the plugins that a site added itself without calling them.
 */
function plugin(
  name: string,
  logger: Logger,
  define: (doc: ReturnType<typeof page>) => Omit<MdastPluginDefinition, 'name'>,
): MdastPluginEntry {
  const factory = (ctx: PluginFactoryContext) => ({ name: PREFIX + name, ...define(page(ctx, logger)) });
  return Object.defineProperty(factory, 'name', { value: PREFIX + name });
}

/**
 * The names of this package's plugins in a list of Sätteri or remark plugins, without calling any factory.
 * It looks into nested lists, remark's `[plugin, options]` and plugins from `remarkFromSatteri()`.
 */
export function markdownPluginNames(list: unknown, names = new Set<string>()): Set<string> {
  if (Array.isArray(list)) for (const entry of list) markdownPluginNames(entry, names);
  else if (list && (typeof list === 'function' || typeof list === 'object')) {
    const { name, mdastPlugins } = list as { name?: unknown; mdastPlugins?: unknown };
    if (typeof name === 'string' && name.startsWith(PREFIX)) names.add(name);
    if (mdastPlugins) markdownPluginNames(mdastPlugins, names);
  }
  return names;
}

/** Turns `:::code-tabs` directives into code tabs. */
export function mdastCodeTabs(settings?: CodeblocksOptions['codeTabs'], logger = consoleLogger): MdastPluginEntry {
  const { control } = resolve('codeTabs', settings || {}) as { control: TabsVariant['control'] };
  return plugin('code-tabs', logger, ({ file, say }) => ({
    containerDirective(node) {
      if (node.name === 'code-tabs') return codeTabs(node, file, control, say);
    },
  }));
}

/** Highlights inline code with a `{:lang}` suffix, or all inline code with `defaultLanguage`. */
export function mdastInlineHighlighting(
  settings?: CodeblocksOptions['inlineHighlighting'],
  logger = consoleLogger,
): MdastPluginEntry {
  const { defaultLanguage } = resolve('inlineHighlighting', settings || {}) as { defaultLanguage: string | false };
  return plugin('inline-highlighting', logger, ({ warn }) => ({
    inlineCode: async (node, ctx) => (await inlineCode(node, ctx, warn, defaultLanguage)) as never,
  }));
}

/** Adds a swatch before each colour in the text of the page, and in inline code that is one colour. */
export function mdastSwatches(settings?: CodeblocksOptions['swatches'], logger = consoleLogger): MdastPluginEntry {
  const swatches = resolve('swatches', settings || {}) as SwatchSettings;
  return plugin('swatches', logger, ({ say }) => {
    const texts = swatches.copy ? swatchTexts(say) : undefined;
    return {
      // Inline code that another plugin rendered, such as with inline highlighting, has `data`.
      inlineCode: (node) => (node.data ? undefined : inlineSwatch(node, swatches, texts)) as never,
      text(node, ctx) {
        const nodes = proseSwatches(node, swatches, texts);
        if (nodes) ctx.replaceNode(node, nodes as never);
      },
    };
  });
}

/** Keeps the trailing whitespace of each line of code, which Expressive Code trims, for visible whitespace. */
export function mdastWhitespace(logger = consoleLogger): MdastPluginEntry {
  return plugin('whitespace', logger, () => ({
    before(root, ctx) {
      walk(root as Nodes, (node) => {
        if (node.type !== 'code') return;
        const meta = withTrailingWhitespace(node.value, node.meta ?? '');
        if (meta !== (node.meta ?? '')) ctx.setProperty(node, 'meta', meta);
      });
    },
  }));
}

/** Turns each code mention link that no block tags into plain text, with a warning. */
export function mdastMentions(settings?: CodeblocksOptions['notation'], logger = consoleLogger): MdastPluginEntry {
  // Without notation, no block can tag a name.
  const notation = settings === false ? false : resolve('notation', settings ?? {});
  return plugin('mentions', logger, ({ warn, fileURL }) => ({
    before(root, ctx) {
      const events: Event[] = [];
      const malformed: Link[] = [];
      let section = 0;
      walk(root as Nodes, (node) => {
        if (node.type === 'heading') section++;
        if (node.type === 'code') events.push({ section, names: mentionNames(node, notation) });
        if (node.type === 'link' && node.url.startsWith(MENTION)) {
          try {
            events.push({ section, link: node, name: decodeURIComponent(node.url.slice(MENTION.length)) });
          } catch {
            malformed.push(node);
          }
        }
      });
      for (const link of malformed) {
        warn(`the link to \`${link.url}\` has a malformed % escape. It shows as plain text.`);
        ctx.replaceNode(link, [...link.children]);
      }
      // A render with no file, such as a starlight-pydocs docstring, is part of a page: the client pairs its links.
      if (fileURL) checkMentions(events, ctx, warn);
    },
  }));
}

/** Warns about two code blocks with the same `id`, which line permalinks need to tell apart. */
export function mdastPermalinks(logger = consoleLogger): MdastPluginEntry {
  return plugin('permalinks', logger, ({ warn }) => ({
    before(root) {
      const codes: Code[] = [];
      walk(root as Nodes, (node) => {
        if (node.type === 'code') codes.push(node);
      });
      checkIds(codes, warn);
    },
  }));
}

/** The Markdown plugins of the features that are on, in the order they must run. */
export function mdastPlugins(options: ResolvedOptions, logger: Logger = consoleLogger): MdastPluginEntry[] {
  return [
    options.whitespace && mdastWhitespace(logger),
    options.mentions && mdastMentions(options.notation, logger),
    options.permalinks && mdastPermalinks(logger),
    options.codeTabs && mdastCodeTabs(options.codeTabs, logger),
    // Before swatches, so that highlighted inline code keeps its colours as text.
    options.inlineHighlighting && mdastInlineHighlighting(options.inlineHighlighting, logger),
    options.swatches !== false && options.swatches.prose && mdastSwatches(options.swatches, logger),
  ].filter((entry): entry is MdastPluginEntry => Boolean(entry));
}

/**
 * Every Markdown plugin, with the options of `codeblocks()`. With no options on a site with `codeblocks()`,
 * it reads the options given to `codeblocks()` when it renders a page, so it can go in `astro.config.mjs`.
 */
export function mdastCodeblocks(options?: CodeblocksOptions, logger = consoleLogger): MdastPluginEntry {
  const resolved = options && resolveOptions(options);
  const group = () => mdastPlugins(resolved ?? getRegistry()?.options ?? resolveOptions(), logger);
  return Object.defineProperty(group, 'name', { value: MARKDOWN_GROUP });
}

/**
 * Gives back the source of each directive that no plugin claimed, as Starlight does, so that prose
 * such as `16:9` keeps its text once a site without Starlight turns on directives for code tabs.
 */
export function restoreDirectives(): MdastPluginDefinition {
  const source = (node: MdastNode, ctx: MdastVisitorContext) =>
    ctx.source.slice(node.position?.start.offset, node.position?.end.offset);
  return {
    name: 'starlight-codeblocks:directives',
    options: { position: true },
    textDirective: (node, ctx) => (node.data ? undefined : { type: 'text', value: source(node, ctx) }),
    leafDirective: (node, ctx) =>
      node.data ? undefined : { type: 'paragraph', children: [{ type: 'text', value: source(node, ctx) }] },
    containerDirective: (node) =>
      node.data ? undefined : { type: 'paragraph', data: { hName: 'div' }, children: [...node.children] },
  } as MdastPluginDefinition;
}
