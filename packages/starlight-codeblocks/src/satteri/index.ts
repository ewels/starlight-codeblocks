import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MetaOptions } from '@expressive-code/core';
import type { Code, Nodes } from 'mdast';
import type { MdastPluginDefinition, MdastPluginEntry, PluginFactoryContext } from 'satteri';
import type { ResolvedOptions } from '../options.ts';

export interface Logger {
  warn(message: string): void;
}

/** Every node of the tree in document order, with the headings that start each section. */
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

/** The Sätteri plugins for syntax outside code blocks, one instance for each document. */
export function mdastPlugins(options: ResolvedOptions, logger: Logger): MdastPluginEntry[] {
  return [
    ({ fileURL }: PluginFactoryContext): MdastPluginDefinition => ({
      name: 'starlight-codeblocks',
      before(root) {
        const codes: Code[] = [];
        walk(root as Nodes, (node) => {
          if (node.type === 'code') codes.push(node);
        });
        if (options.permalinks) checkIds(codes, fileName(fileURL), logger);
      },
    }),
  ];
}
