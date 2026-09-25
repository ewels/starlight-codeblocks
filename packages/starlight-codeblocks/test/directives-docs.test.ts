import { expect, test } from 'vitest';
import type { CodeblocksPlugin } from '../src/expressive-code/core.ts';
import { createPlugins } from '../src/expressive-code/index.ts';
import { resolveOptions } from '../src/options.ts';
import { render } from './render.ts';

const directives = createPlugins(resolveOptions()).flatMap((plugin) =>
  Object.entries((plugin as CodeblocksPlugin).directives ?? {}),
);

test('finds the directives', () => {
  expect(directives.length).toBeGreaterThan(5);
});

// The directives reference page in the docs renders every `docs.example` next to its source.
test.each(directives)('[!%s] has docs with an example that renders cleanly', async (name, spec) => {
  expect(spec.docs, `add \`docs\` with an \`example\` to the [!${name}] directive`).toBeDefined();
  const { lang, code } = spec.docs?.example ?? { lang: '', code: '' };
  expect(code).toContain(`[!${name}`);
  const { html, warnings } = await render(`\`\`\`${lang}\n${code}\n\`\`\``);
  expect(warnings).toEqual([]);
  expect(html).not.toContain(`[!${name}`);
});
