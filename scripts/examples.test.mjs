import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = new URL('../docs/src/content/docs/', import.meta.url).pathname;
const pages = readdirSync(root, { recursive: true }).filter((f) => f.endsWith('.mdx'));

// Strings in `export const x = \`…\`` escape backticks, dollars and backslashes, and also use `\t` for a
// real tab (Prettier would otherwise reindent a literal tab in the file); the live copy has none of this.
const unescapeTemplate = (s) => s.replace(/\\([`$\\t])/g, (_, c) => (c === 't' ? '\t' : c));
// MDX needs `\{:lang}` after inline code, and the source shows the `.md` form.
const unescapeMdx = (s) => s.replaceAll('`\\{:', '`{:');

// The rendered blocks get the hidden attributes on each opening fence line.
const withAttributes = (s, attrs) => (attrs ? s.replace(/^(`{3,}|~{3,})(\S.*)$/gm, `$1$2 ${attrs}`) : s);

/** The Markdown that `<Example code={name} hiddenAttributes={hidden}>` renders. */
function rendered(text, file, name, hidden) {
  const source = text.match(new RegExp(`export const ${name} = \`([\\s\\S]*?)\`;\\n`))?.[1];
  assert.ok(source !== undefined, `${file}: no export const ${name}`);
  return withAttributes(unescapeTemplate(source).trim(), hidden);
}

test('each <Example> with live Markdown shows the same Markdown as its source pane', () => {
  let checked = 0;
  for (const page of pages) {
    const text = readFileSync(join(root, page), 'utf8');
    for (const [, name, , hidden, live] of text.matchAll(
      /<Example code=\{(\w+)\}( hiddenAttributes="([^"]*)")?(?: layout="\w+")?>\n([\s\S]*?)\n<\/Example>/g,
    )) {
      assert.equal(
        unescapeMdx(live.trim()),
        rendered(text, page, name, hidden),
        `${page}: <Example code={${name}}> differs from its source`,
      );
      checked++;
    }
  }
  assert.ok(checked > 0);
});

test("the home page carousel shows the same example as each feature page's first <Example>", () => {
  const indexText = readFileSync(join(root, 'index.mdx'), 'utf8');
  let checked = 0;
  for (const [, pageId, slide] of indexText.matchAll(/<Feature page="([^"]+)"[^>]*>\n([\s\S]*?)\n<\/Feature>/g)) {
    const pageText = readFileSync(join(root, `${pageId}.mdx`), 'utf8');
    const example = pageText.match(
      /<Example code=\{(\w+)\}(?:\s+hiddenAttributes="([^"]*)")?(?:\s+layout="\w+")?\s*\/?>/,
    );
    assert.ok(example, `index.mdx: "${pageId}" slide, but that page has no <Example> to compare it against`);
    const [, name, hidden] = example;
    assert.equal(
      unescapeMdx(slide.trim()),
      rendered(pageText, `${pageId}.mdx`, name, hidden),
      `index.mdx: the "${pageId}" slide differs from that page's first <Example> — a page example changed without its carousel slide`,
    );
    checked++;
  }
  assert.ok(checked > 0);
});

test('the source pane of an <Example> shows no attribute that only turns another feature off', () => {
  // The API auto-linking page shows `apiLinks=false` as its own syntax.
  for (const page of pages.filter((p) => !p.endsWith('api-auto-linking.mdx'))) {
    const text = readFileSync(join(root, page), 'utf8');
    for (const [, name, source] of text.matchAll(/export const (\w+) = `([\s\S]*?)`;\n/g)) {
      assert.doesNotMatch(
        source,
        /^(\\`){3}\S.* (apiLinks|wordDiff)=false/m,
        `${page}: ${name} shows a feature-off attribute`,
      );
    }
  }
});
