import type { CodeblocksPlugin } from '../../../packages/starlight-codeblocks/src/expressive-code/core.ts';
import { createPlugins } from '../../../packages/starlight-codeblocks/src/expressive-code/index.ts';
import { resolveOptions } from '../../../packages/starlight-codeblocks/src/options.ts';
import { attributesReference, styleSettingsReference } from '../../../packages/starlight-codeblocks/src/reference.ts';

const plugins = createPlugins(resolveOptions()) as CodeblocksPlugin[];
const words: Record<string, string> = { '++': 'insert', '--': 'delete' };

/** Every directive with its docs, for the directives reference page and its table of contents. */
export const directives = plugins.flatMap((plugin) =>
  Object.entries(plugin.directives ?? {}).flatMap(([name, { placement, docs }]) =>
    docs
      ? [
          {
            id: name.replace(/\S+/g, (word) => words[word] ?? word).replace(/ /g, '-'),
            label: `[!${name}]`,
            placement,
            docs,
          },
        ]
      : [],
  ),
);

export const attributes = attributesReference.map((attribute) => ({
  ...attribute,
  id: attribute.name === '<state>' ? 'custom-state' : attribute.name.toLowerCase(),
}));

/** Each style settings group with its default values, in the order of the plugins. */
export const styleGroups = plugins.flatMap((plugin) =>
  Object.entries((plugin.styleSettings?.defaultValues ?? {}) as Record<string, Record<string, unknown>>).map(
    ([name, defaults]) => ({ name, defaults, ...styleSettingsReference[name] }),
  ),
);

/** Headings that components write, so Starlight does not see them, by docs entry. */
export const componentHeadings: Record<string, { slug: string; text: string }[]> = {
  'reference/directives': directives.map(({ id, label }) => ({ slug: id, text: label })),
  'reference/attributes': attributes.map(({ id, syntax }) => ({ slug: id, text: syntax.join(', ') })),
  'reference/style-settings': styleGroups.map(({ name }) => ({ slug: name.toLowerCase(), text: name })),
};
