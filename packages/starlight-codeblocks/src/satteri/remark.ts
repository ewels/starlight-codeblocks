import { pathToFileURL } from 'node:url';
import type { Nodes, Parent, Root } from 'mdast';
import type { MdastPluginDefinition, MdastPluginEntry, MdastVisitorContext, PluginFactoryContext } from 'satteri';

type Visitor = (node: Nodes, ctx: MdastVisitorContext) => unknown;

/**
 * Runs Sätteri plugin definitions as a remark plugin, for sites on Astro's `unified()` processor.
 * It gives the visitors the part of Sätteri's context that this package uses, over a mutable tree.
 */
export function remarkFromSatteri(entries: MdastPluginEntry[]) {
  const attacher = () => async (tree: Root, file: { path?: string; value?: unknown }) => {
    const factory = {
      fileURL: file.path ? pathToFileURL(file.path) : undefined,
      sourceFormat: file.path?.endsWith('.mdx') ? 'mdx' : 'markdown',
      source: String(file.value ?? ''),
      data: {},
    } as PluginFactoryContext;
    for (const definition of unfold(entries, factory)) await run(definition, tree);
  };
  // So that `codeblocks()` can find the plugins inside.
  return Object.defineProperty(attacher, 'mdastPlugins', { value: entries });
}

/** The definitions in a list of entries, with factories called and nested lists flattened, as Sätteri does. */
function unfold(entry: MdastPluginEntry, factory: PluginFactoryContext): MdastPluginDefinition[] {
  if (!entry) return [];
  if (typeof entry === 'function') return unfold(entry(factory), factory);
  if (Array.isArray(entry)) return entry.flatMap((e) => unfold(e, factory));
  return [entry as MdastPluginDefinition];
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
    if (result) replaceNode(node, result);
  }
  await definition.after?.(tree as never, ctx);
}
