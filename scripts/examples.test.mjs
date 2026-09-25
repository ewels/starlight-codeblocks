import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = new URL('../docs/src/content/docs/', import.meta.url).pathname;
const pages = readdirSync(root, { recursive: true }).filter((f) => f.endsWith('.mdx'));

// Strings in `export const x = \`…\`` escape backticks, and the live copy between the tags does not.
const unescapeTemplate = (s) => s.replace(/\\([`$\\])/g, '$1');
// MDX needs `\{:lang}` after inline code, and the source shows the `.md` form.
const unescapeMdx = (s) => s.replaceAll('`\\{:', '`{:');

test('each <Example> with live Markdown shows the same Markdown as its source pane', () => {
  let checked = 0;
  for (const page of pages) {
    const text = readFileSync(join(root, page), 'utf8');
    for (const [, name, live] of text.matchAll(/<Example code=\{(\w+)\}>\n([\s\S]*?)\n<\/Example>/g)) {
      const source = text.match(new RegExp(`export const ${name} = \`([\\s\\S]*?)\`;\\n`))?.[1];
      assert.ok(source !== undefined, `${page}: no export const ${name}`);
      assert.equal(
        unescapeMdx(live.trim()),
        unescapeTemplate(source).trim(),
        `${page}: <Example code={${name}}> differs from its source`,
      );
      checked++;
    }
  }
  assert.ok(checked > 0);
});
