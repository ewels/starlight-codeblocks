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
import { encodeVariant, SWITCHER_META } from '../expressive-code/code-switcher.ts';
import { commentSyntaxFor } from '../expressive-code/comments.ts';
import { bundledLanguage } from '../expressive-code/core.ts';
import { parseNotation } from '../expressive-code/notation.ts';
import { findColours, SWATCH, type SwatchSettings, wholeColour } from '../expressive-code/swatches.ts';
import { withTrailingWhitespace } from '../expressive-code/whitespace.ts';
import type { ResolvedOptions } from '../options.ts';
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

function languageName(lang: string | null | undefined) {
  if (!lang) return 'Plain text';
  return bundledLanguage(lang)?.name ?? lang;
}

/** Turns `:::code-switcher{sync="…"}` into a wrapper whose code blocks each carry the variant menu. */
function codeSwitcher(node: ContainerDirective, file: string): MdastNode {
  const codes = node.children;
  if (codes.length === 0 || codes.some((child) => child.type !== 'code')) {
    throw new Error(`${file}: \`:::code-switcher\` can contain only fenced code blocks, and needs at least one.`);
  }
  const labels = (codes as Code[]).map(
    (code) => new MetaOptions(code.meta ?? '').getString('label') ?? languageName(fenceLanguage(code)),
  );
  const repeated = labels.find((label, i) => labels.indexOf(label) !== i);
  if (repeated !== undefined) {
    throw new Error(
      `${file}: two variants in a \`:::code-switcher\` have the label "${repeated}". Give each variant a different \`label="…"\`.`,
    );
  }
  return {
    type: 'paragraph',
    data: {
      hName: 'div',
      hProperties: { className: ['scb-switcher'], dataScbCodeSwitcher: node.attributes?.sync ?? '' },
    },
    children: (codes as Code[]).map((code, index) => ({
      ...code,
      meta: `${code.meta ?? ''} ${SWITCHER_META}="${encodeVariant({ index, labels })}"`.trim(),
    })),
  } as unknown as MdastNode;
}

const swatchHast = (colour: string) => ({
  className: [`${SWATCH}-text`],
  dataScbColour: colour,
  dataScbSwatches: '',
  style: `--scb-swatch: ${colour}`,
});
const chipHast = { className: [SWATCH], ariaHidden: 'true' };

/** The text with a swatch before each colour, or `undefined` when it has none. */
function proseSwatches(node: Text, { formats }: SwatchSettings) {
  const matches = findColours(node.value, 'prose', formats);
  if (matches.length === 0) return;
  const nodes: unknown[] = [];
  let at = 0;
  for (const { start, end, colour } of matches) {
    if (start > at) nodes.push({ type: 'text', value: node.value.slice(at, start) });
    nodes.push({
      type: 'scbSwatch',
      data: { hName: 'span', hProperties: swatchHast(colour) },
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
function inlineSwatch(node: InlineCode, { formats }: SwatchSettings) {
  const colour = wholeColour(node.value, formats);
  if (!colour) return;
  const chip = { type: 'element', tagName: 'span', properties: chipHast, children: [] };
  const text = { type: 'text', value: node.value };
  return {
    type: 'inlineCode',
    value: node.value,
    data: {
      hName: 'code',
      hChildren: [{ type: 'element', tagName: 'span', properties: swatchHast(colour), children: [chip, text] }],
    },
  } as InlineCode;
}

/** The Sätteri plugins for syntax outside code blocks, one instance for each document. */
export function mdastPlugins(options: ResolvedOptions, logger: Logger): MdastPluginEntry[] {
  const defaultLanguage = options.inlineHighlighting ? options.inlineHighlighting.defaultLanguage : false;
  const prose = options.swatches !== false && options.swatches.prose ? options.swatches : undefined;
  return [
    ({ fileURL }: PluginFactoryContext): MdastPluginDefinition => {
      const file = fileName(fileURL);
      const warn = (message: string) => logger.warn(`${file}: ${message}`);
      return {
        name: 'starlight-codeblocks',
        before(root, ctx) {
          const codes: Code[] = [];
          const events: Event[] = [];
          const malformed: Link[] = [];
          let section = 0;
          // A render with no file, such as a starlight-pydocs docstring, is part of a page: the client pairs its links.
          const checkLinks = options.mentions && fileURL;
          walk(root as Nodes, (node) => {
            if (node.type === 'heading') section++;
            if (node.type === 'code') {
              codes.push(node);
              const meta = withTrailingWhitespace(node.value, node.meta ?? '');
              if (options.whitespace && meta !== (node.meta ?? '')) ctx.setProperty(node, 'meta', meta);
              if (checkLinks) events.push({ section, names: mentionNames(node, options.notation) });
            }
            if (node.type === 'link' && node.url.startsWith(MENTION)) {
              try {
                const name = decodeURIComponent(node.url.slice(MENTION.length));
                if (checkLinks) events.push({ section, link: node, name });
              } catch {
                malformed.push(node);
              }
            }
          });
          for (const link of malformed) {
            warn(`the link to \`${link.url}\` has a malformed % escape. It shows as plain text.`);
            ctx.replaceNode(link, [...link.children]);
          }
          if (options.permalinks) checkIds(codes, warn);
          if (checkLinks) checkMentions(events, ctx, warn);
        },
        containerDirective(node) {
          if (options.codeSwitcher && node.name === 'code-switcher') return codeSwitcher(node, file);
        },
        ...((options.inlineHighlighting || prose) && {
          inlineCode: async (node, ctx) =>
            ((options.inlineHighlighting && (await inlineCode(node, ctx, warn, defaultLanguage))) ||
              (prose && inlineSwatch(node, prose))) as never,
        }),
        ...(prose && {
          text(node, ctx) {
            const nodes = proseSwatches(node, prose);
            if (nodes) ctx.replaceNode(node, nodes as never);
          },
        }),
      };
    },
  ];
}
