import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import remarkDirective from 'remark-directive';
import { expect, test } from 'vitest';
import { codeblocksIntegration } from '../src/integration.ts';
import { resolveOptions } from '../src/options.ts';
import { mdastPlugins } from '../src/satteri/index.ts';
import { remarkFromSatteri } from '../src/satteri/remark.ts';

async function md(markdown: string, options = {}) {
  const warnings: string[] = [];
  const plugin = remarkFromSatteri(mdastPlugins(resolveOptions(options), { warn: (m) => warnings.push(m) }));
  const processor = await createMarkdownProcessor({ syntaxHighlight: false, remarkPlugins: [remarkDirective, plugin] });
  const { code } = await processor.render(markdown, { fileURL: new URL('file:///site/page.md') });
  return { html: code, warnings };
}

test('turns a code switcher into a wrapper whose blocks carry the menu', async () => {
  const { html } = await md(
    [':::code-switcher{sync="pm"}', '```sh', 'npm i x', '```', '```sh label="pnpm"', 'pnpm add x', '```', ':::'].join(
      '\n',
    ),
  );
  expect(html).toContain('<div class="scb-switcher" data-scb-code-switcher="pm">');
  expect(html.match(/<pre><code class="language-sh">/g)).toHaveLength(2);
  expect(html).not.toContain(':::');
});

test('highlights inline code with a {:lang} suffix, with and without directives', async () => {
  const { html, warnings } = await md('Call `await fetch(url)`{:js} now.');
  expect(html).toMatch(/<p>Call <code class="scb-inline" data-lang="js"><span style="--0:#[0-9A-F]+/);
  expect(html).toMatch(/<\/code> now\.<\/p>/);
  expect(html).not.toContain('{');
  expect(warnings).toEqual([]);
});

test('keeps text after the suffix and leaves code without one alone', async () => {
  const { html } = await md('`x`{:js}, then `y` {:py}');
  // Starlight restores the unused `:py` directive as text on a real site.
  expect(html).toMatch(/<\/code>, then <code>y<\/code> \{/);
});

test('turns a mention link with no block into plain text, with a warning', async () => {
  const { html, warnings } = await md('See [the value](#mention:x).');
  expect(html).toContain('<p>See the value.</p>');
  expect(warnings).toEqual([expect.stringContaining('page.md: the link to `#mention:x` has no code block')]);
  const kept = await md(['See [it](#mention:x).', '', '```py', 'x = 1  # [!mention x]', '```'].join('\n'));
  expect(kept.html).toContain('href="#mention:x"');
});

test('warns about two blocks with the same id', async () => {
  const block = ['```js id="a"', 'x', '```'].join('\n');
  expect((await md(`${block}\n\n${block}`)).warnings).toEqual([
    expect.stringContaining('two code blocks have `id="a"`'),
  ]);
});

test('changes nothing with the features off', async () => {
  const source = 'See [it](#mention:x) and `x`{:js}.';
  const off = { mentions: false, inlineHighlighting: false, codeSwitcher: false, permalinks: false };
  const plain = await createMarkdownProcessor({ syntaxHighlight: false, remarkPlugins: [remarkDirective] });
  const expected = (await plain.render(source, { fileURL: new URL('file:///site/page.md') })).code;
  expect((await md(source, off)).html).toBe(expected);
});

test('registers the remark plugin only for the unified() processor', () => {
  const setup = (processor: object) => {
    const hook = codeblocksIntegration({ options: resolveOptions() }).hooks['astro:config:setup'] as (
      p: unknown,
    ) => void;
    hook({
      config: { markdown: { processor }, build: { assets: '_astro' } },
      updateConfig() {},
      logger: { warn() {} },
    });
    return processor;
  };
  const unified = setup({ name: 'unified', options: { remarkPlugins: [], mdastPlugins: [] } }) as never as {
    options: { remarkPlugins: unknown[]; mdastPlugins: unknown[] };
  };
  expect([unified.options.remarkPlugins.length, unified.options.mdastPlugins.length]).toEqual([1, 0]);
  const satteri = setup({ name: 'satteri', options: { mdastPlugins: [] } }) as never as {
    options: { mdastPlugins: unknown[] };
  };
  expect(satteri.options.mdastPlugins).toHaveLength(1);
});

test('takes the suffix inside the backticks too', async () => {
  const { html } = await md('Call `fetch(url){:js}` now.');
  expect(html).toMatch(/<p>Call <code class="scb-inline" data-lang="js"><span/);
  expect(html).not.toContain('{:js}');
});
