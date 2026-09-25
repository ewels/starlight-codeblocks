import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import * as ecExports from '../src/expressive-code/index.ts';
import { createPlugins } from '../src/expressive-code/index.ts';
import { builtInStates } from '../src/expressive-code/line-states.ts';
import { resolveOptions } from '../src/options.ts';
import { attributesReference, styleSettingsReference } from '../src/reference.ts';
import { render } from './render.ts';

const src = join(import.meta.dirname, '../src');
const sources = (readdirSync(src, { recursive: true }) as string[])
  .filter((file) => file.endsWith('.ts') && !file.startsWith('client'))
  .map((file) => readFileSync(join(src, file), 'utf8'));

// Expressive Code's own attributes, which its docs cover.
const ecAttributes = new Set(['title', 'startLineNumber']);

test('every attribute that the source reads is in the attributes reference', () => {
  const read = new Set(
    sources.flatMap((code) =>
      [...code.matchAll(/\.(?:get\w+|list)\('(\w+)'\)|resolveRange\(\w+, '(\w+)'\)/g)].map((m) => m[1] ?? m[2]),
    ),
  );
  expect(read.size).toBeGreaterThan(10);
  const documented = new Set(attributesReference.map((a) => a.name));
  const missing = [...read].filter((name) => name && !ecAttributes.has(name) && !documented.has(name));
  expect(missing, 'add these attributes to `attributesReference` in src/reference.ts').toEqual([]);
});

// The options of the docs site, which renders these examples.
const site = {
  lineStates: { states: { todo: { label: 'To do', colour: { dark: '#c792ea', light: '#7c3aed' } } } },
  runnable: { runtimes: { python: 'starlight-codeblocks/runtimes/pyodide' } },
};

test.each(attributesReference.filter((a) => a.example))(
  'the $name example renders cleanly and uses the attribute',
  async ({ example }) => {
    const { lang, meta, code } = example ?? { lang: '', meta: '', code: '' };
    const withAttribute = await render(`\`\`\`${lang} ${meta}\n${code}\n\`\`\``, site);
    const without = await render(`\`\`\`${lang}\n${code}\n\`\`\``, site);
    expect(withAttribute.warnings).toEqual([]);
    expect(withAttribute.html).not.toEqual(without.html);
  },
);

test('every style setting is in the style settings reference, with a derivation for computed defaults', () => {
  const states = Object.keys(builtInStates);
  for (const plugin of createPlugins(resolveOptions())) {
    const groups = (plugin.styleSettings?.defaultValues ?? {}) as Record<string, Record<string, unknown>>;
    for (const [group, settings] of Object.entries(groups)) {
      const docs = styleSettingsReference[group]?.settings ?? {};
      const documented = Object.keys(docs).flatMap((key) =>
        key.startsWith('<state>') ? states.map((s) => key.replace('<state>', s)) : [key],
      );
      expect(Object.keys(settings).sort(), `\`styleSettingsReference.${group}\` in src/reference.ts`).toEqual(
        documented.sort(),
      );
      for (const [key, doc] of Object.entries(docs)) {
        const value = settings[key.replace('<state>', states[0] ?? '')];
        expect(doc.derived !== undefined, `${group}.${key}: \`derived\` only for computed defaults`).toBe(
          typeof value === 'function',
        );
      }
    }
  }
  const groups = createPlugins(resolveOptions()).flatMap((p) => Object.keys(p.styleSettings?.defaultValues ?? {}));
  expect(Object.keys(styleSettingsReference).sort()).toEqual(groups.sort());
});

test('the Expressive Code plugins page names every plugin', () => {
  const page = readFileSync(
    join(import.meta.dirname, '../../../docs/src/content/docs/reference/expressive-code-plugins.mdx'),
    'utf8',
  );
  const plugins = Object.keys(ecExports).filter((name) => name.startsWith('plugin'));
  expect(plugins.filter((name) => !page.includes(`\`${name}(`))).toEqual([]);
});
