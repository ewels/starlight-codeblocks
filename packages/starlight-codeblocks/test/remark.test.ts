import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import remarkDirective from 'remark-directive';
import { markdownToHtml } from 'satteri';
import { expect, test } from 'vitest';
import { codeblocksIntegration } from '../src/integration.ts';
import { resolveOptions } from '../src/options.ts';
import { markdownPluginNames, mdastCodeblocks, mdastCodeTabs, mdastPlugins } from '../src/satteri/index.ts';
import { remarkFromSatteri } from '../src/satteri/remark.ts';

async function md(markdown: string, options = {}) {
  const warnings: string[] = [];
  const plugin = remarkFromSatteri(mdastPlugins(resolveOptions(options), { warn: (m) => warnings.push(m) }));
  const processor = await createMarkdownProcessor({ syntaxHighlight: false, remarkPlugins: [remarkDirective, plugin] });
  const { code } = await processor.render(markdown, { fileURL: new URL('file:///site/page.md') });
  return { html: code, warnings };
}

test('turns code tabs into a wrapper whose blocks carry their variant', async () => {
  const { html } = await md(
    [':::code-tabs{sync="pm"}', '```sh', 'npm i x', '```', '```sh label="pnpm"', 'pnpm add x', '```', ':::'].join('\n'),
  );
  expect(html).toContain('<div class="scb-tabs" data-scb-code-tabs="pm" data-scb-control="tabs"');
  expect(html.match(/<pre><code class="language-sh">/g)).toHaveLength(2);
  expect(html).not.toContain(':::');
});

test('highlights inline code with a {:lang} suffix, outside or inside the backticks, with + or #', async () => {
  const { html, warnings } = await md(
    'Call `await fetch(url)`{:js} now, `fetch(url){:js}`, `int x`{:c++} and `var x`{:c#}.',
  );
  expect(html).toMatch(/<p>Call <code class="scb-inline" data-lang="js"><span style="--0:#[0-9A-F]+/);
  expect(html.match(/data-lang="js"/g)).toHaveLength(2);
  expect(html).toContain('data-lang="c++"');
  expect(html).toContain('data-lang="c#"');
  expect(html).toMatch(/<\/code> now, <code/);
  expect(html).not.toContain('{');
  expect(warnings).toEqual([]);
  // Starlight restores the unused `:py` directive as text on a real site.
  expect((await md('`x`{:js}, then `y` {:py}')).html).toMatch(/<\/code>, then <code>y<\/code> \{/);
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
  const off = { mentions: false, inlineHighlighting: false, codeTabs: false, permalinks: false };
  const plain = await createMarkdownProcessor({ syntaxHighlight: false, remarkPlugins: [remarkDirective] });
  const expected = (await plain.render(source, { fileURL: new URL('file:///site/page.md') })).code;
  expect((await md(source, off)).html).toBe(expected);
});

const setup = (processor: object) => {
  const hook = codeblocksIntegration({ options: resolveOptions() }).hooks['astro:config:setup'] as (p: unknown) => void;
  hook({
    config: { markdown: { processor }, base: '/', build: { assets: '_astro' } },
    updateConfig() {},
    injectScript() {},
    logger: { warn() {} },
  });
  return processor;
};

test('registers the remark plugin only for the unified() processor', () => {
  const unified = setup({ name: 'unified', options: { remarkPlugins: [], mdastPlugins: [] } }) as never as {
    options: { remarkPlugins: unknown[]; mdastPlugins: unknown[] };
  };
  expect([unified.options.remarkPlugins.length, unified.options.mdastPlugins.length]).toEqual([1, 0]);
  const satteri = setup({ name: 'satteri', options: { mdastPlugins: [] } }) as never as {
    options: { mdastPlugins: unknown[] };
  };
  expect(satteri.options.mdastPlugins).toHaveLength(5);
});

test('adds only the Markdown plugins that the site has not added itself', () => {
  const names = (list: unknown[]) => [...markdownPluginNames(list)];
  const satteri = setup({ name: 'satteri', options: { mdastPlugins: [[mdastCodeTabs({ control: 'menu' })]] } }) as {
    options: { mdastPlugins: unknown[] };
  };
  expect(names(satteri.options.mdastPlugins)).toEqual([
    'starlight-codeblocks:code-tabs',
    'starlight-codeblocks:whitespace',
    'starlight-codeblocks:mentions',
    'starlight-codeblocks:permalinks',
    'starlight-codeblocks:inline-highlighting',
  ]);
  const group = setup({ name: 'satteri', options: { mdastPlugins: [mdastCodeblocks()] } }) as {
    options: { mdastPlugins: unknown[] };
  };
  expect(group.options.mdastPlugins).toHaveLength(1);
  const unified = setup({
    name: 'unified',
    options: { remarkPlugins: [[remarkFromSatteri([mdastCodeTabs()]), {}]] },
  }) as { options: { remarkPlugins: unknown[] } };
  expect(unified.options.remarkPlugins).toHaveLength(2);
  expect(names(unified.options.remarkPlugins)).toHaveLength(5);
});

test('runs the group and single plugins on unified(), with their own settings', async () => {
  const render = async (plugins: Parameters<typeof remarkFromSatteri>[0], markdown: string) => {
    const processor = await createMarkdownProcessor({
      syntaxHighlight: false,
      remarkPlugins: [remarkDirective, remarkFromSatteri(plugins)],
    });
    return (await processor.render(markdown, { fileURL: new URL('file:///site/page.md') })).code;
  };
  const tabs = [':::code-tabs', '```sh', 'npm i x', '```', ':::'].join('\n');
  expect(await render([mdastCodeTabs({ control: 'menu' })], tabs)).toContain('data-scb-control="menu"');
  const group = await render([mdastCodeblocks({ swatches: { prose: true } })], `${tabs}\n\nRed is #f00.`);
  expect(group).toContain('data-scb-control="tabs"');
  expect(group).toContain('data-scb-colour="#f00"');
  expect(await render([mdastCodeblocks({ codeTabs: false })], tabs)).not.toContain('scb-tabs');
});

test('runs the group on Sätteri, which calls its factories for each document', async () => {
  const { html } = await markdownToHtml('Call `fetch(url){:js}` and see #f00.', {
    mdastPlugins: [mdastCodeblocks({ swatches: { prose: true } })],
    fileURL: new URL('file:///site/page.md'),
  });
  expect(html).toContain('data-lang="js"');
  expect(html).toContain('data-scb-colour="#f00"');
});
