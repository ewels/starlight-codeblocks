import type { CodeblocksPlugin } from '../../../packages/starlight-codeblocks/src/expressive-code/core.ts';
import { createPlugins } from '../../../packages/starlight-codeblocks/src/expressive-code/index.ts';
import { resolveOptions } from '../../../packages/starlight-codeblocks/src/options.ts';

const words: Record<string, string> = { '++': 'insert', '--': 'delete' };

/** Every directive with its docs, for the directives reference page and its table of contents. */
export const directives = createPlugins(resolveOptions()).flatMap((plugin) =>
  Object.entries((plugin as CodeblocksPlugin).directives ?? {}).flatMap(([name, { placement, docs }]) =>
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
