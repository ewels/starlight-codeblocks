import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MetaOptions } from '@expressive-code/core';
import type { Code, Link, Nodes } from 'mdast';
import type {
  MdastNode,
  MdastPluginDefinition,
  MdastPluginEntry,
  MdastVisitorContext,
  PluginFactoryContext,
} from 'satteri';
import { bundledLanguagesInfo } from 'shiki/langs';
import { encodeVariant, SWITCHER_META } from '../expressive-code/code-switcher.ts';
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

function checkIds(codes: Code[], file: string, logger: Logger) {
  const seen = new Set<string>();
  for (const code of codes) {
    const id = new MetaOptions(code.meta ?? '').getString('id');
    if (!id) continue;
    if (seen.has(id)) {
      logger.warn(`${file}: two code blocks have \`id="${id}"\`. Line permalinks need a different id for each block.`);
    }
    seen.add(id);
  }
}

const MENTION = '#mention:';
const TAG = /(?<!\\)\[!mention\s+([^\]\s]+)\s*\]/g;

type Event = { section: number } & ({ link: Link; name: string } | { names: Set<string> });

/**
 * A mention link pairs with the next block in its section that tags the name, or else with any block before it.
 * A link with neither becomes plain text.
 */
function checkMentions(events: Event[], ctx: MdastVisitorContext, file: string, logger: Logger) {
  events.forEach((event, i) => {
    if (!('link' in event)) return;
    const tags = (e: Event) => 'names' in e && e.names.has(event.name);
    const later = events.slice(i + 1).some((e) => e.section === event.section && tags(e));
    if (later || events.slice(0, i).some(tags)) return;
    logger.warn(
      `${file}: the link to \`${MENTION}${event.name}\` has no code block with \`[!mention ${event.name}]\` in its section or before it. It shows as plain text.`,
    );
    ctx.replaceNode(event.link, [...event.link.children]);
  });
}

function languageName(lang: string | null | undefined) {
  if (!lang) return 'Plain text';
  return bundledLanguagesInfo.find((info) => info.id === lang || info.aliases?.includes(lang))?.name ?? lang;
}

/** Turns `:::code-switcher{sync="…"}` into a wrapper whose code blocks each carry the variant menu. */
function codeSwitcher(node: ContainerDirective, file: string): MdastNode {
  const codes = node.children;
  if (codes.length === 0 || codes.some((child) => child.type !== 'code')) {
    throw new Error(`${file}: \`:::code-switcher\` can contain only fenced code blocks, and needs at least one.`);
  }
  const labels = (codes as Code[]).map(
    (code) => new MetaOptions(code.meta ?? '').getString('label') ?? languageName(code.lang),
  );
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

/** The Sätteri plugins for syntax outside code blocks, one instance for each document. */
export function mdastPlugins(options: ResolvedOptions, logger: Logger): MdastPluginEntry[] {
  return [
    ({ fileURL }: PluginFactoryContext): MdastPluginDefinition => ({
      name: 'starlight-codeblocks',
      before(root, ctx) {
        const codes: Code[] = [];
        const events: Event[] = [];
        let section = 0;
        walk(root as Nodes, (node) => {
          if (node.type === 'heading') section++;
          if (node.type === 'code') {
            codes.push(node);
            events.push({ section, names: new Set([...node.value.matchAll(TAG)].map((m) => m[1] as string)) });
          }
          if (node.type === 'link' && node.url.startsWith(MENTION)) {
            events.push({ section, link: node, name: decodeURIComponent(node.url.slice(MENTION.length)) });
          }
        });
        if (options.permalinks) checkIds(codes, fileName(fileURL), logger);
        if (options.mentions) checkMentions(events, ctx, fileName(fileURL), logger);
      },
      containerDirective(node) {
        if (options.codeSwitcher && node.name === 'code-switcher') return codeSwitcher(node, fileName(fileURL));
      },
      ...(options.inlineHighlighting && {
        inlineCode: (node, ctx) =>
          inlineCode(node, ctx, (message) => logger.warn(`${fileName(fileURL)}: ${message}`)) as never,
      }),
    }),
  ];
}
