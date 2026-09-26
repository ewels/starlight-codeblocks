import { pathToFileURL } from 'node:url';
import type { Element } from '@expressive-code/core/hast';
import { fromHtml } from 'hast-util-from-html';
import type { Nodes, Parent, Root } from 'mdast';
import type { MdastPluginDefinition, MdastPluginEntry, MdastVisitorContext, PluginFactoryContext } from 'satteri';

type Visitor = (node: Nodes, ctx: MdastVisitorContext) => unknown;

/**
 * Runs Sätteri plugin definitions as a remark plugin, for sites on Astro's `unified()` processor.
 * It gives the visitors the part of Sätteri's context that this package uses, over a mutable tree.
 */
export function remarkFromSatteri(entries: MdastPluginEntry[]) {
  return () => async (tree: Root, file: { path?: string; value?: unknown }) => {
    const factory = {
      fileURL: file.path ? pathToFileURL(file.path) : undefined,
      sourceFormat: file.path?.endsWith('.mdx') ? 'mdx' : 'markdown',
      source: String(file.value ?? ''),
      data: {},
    } as PluginFactoryContext;
    for (const entry of entries) {
      const definition = typeof entry === 'function' ? entry(factory) : entry;
      if (definition && !Array.isArray(definition)) await run(definition as MdastPluginDefinition, tree);
    }
  };
}

async function run(definition: MdastPluginDefinition, tree: Root) {
  const parents = new Map<Nodes, Parent>();
  const order: Nodes[] = [];
  const index = (node: Nodes) => {
    order.push(node);
    if ('children' in node) {
      for (const child of node.children) {
        parents.set(child, node);
        index(child);
      }
    }
  };
  index(tree);
  const replaceNode = (node: Nodes, content: unknown) => {
    const parent = parents.get(node);
    const at = parent?.children.indexOf(node as never) ?? -1;
    if (!parent || at < 0) return;
    const nodes = ([] as unknown[]).concat(content) as Nodes[];
    parent.children.splice(at, 1, ...(nodes as never[]));
    for (const child of nodes) parents.set(child, parent);
  };
  const ctx = {
    parent: (node: Nodes) => parents.get(node),
    indexOf: (node: Nodes) => parents.get(node)?.children.indexOf(node as never),
    replaceNode,
    removeNode: (node: Nodes) => replaceNode(node, []),
    setProperty: (node: Nodes, key: string, value: unknown) => {
      (node as unknown as Record<string, unknown>)[key] = value;
    },
  } as unknown as MdastVisitorContext;

  await definition.before?.(tree as never, ctx);
  for (const node of order) {
    const visit = (definition as unknown as Record<string, Visitor | undefined>)[node.type];
    if (typeof visit !== 'function' || !parents.get(node)?.children.includes(node as never)) continue;
    const result = (await visit(node, ctx)) as Nodes | undefined;
    if (result) replaceNode(node, result.type === 'html' ? htmlNode(result.value) : result);
  }
  await definition.after?.(tree as never, ctx);
}

/** Raw HTML as a node that remark-rehype renders in `.md` and `.mdx`, with or without `allowDangerousHtml`. */
function htmlNode(html: string): Nodes {
  const element = fromHtml(html, { fragment: true }).children[0] as Element;
  return {
    type: 'text',
    value: '',
    data: { hName: element.tagName, hProperties: element.properties, hChildren: element.children },
  } as Nodes;
}
