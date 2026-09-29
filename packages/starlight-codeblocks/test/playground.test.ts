import LZString from 'lz-string';
import { expect, test } from 'vitest';
import { block, render } from './render.ts';

const href = (html: string) =>
  (html.match(/<a class="scb-btn scb-playground scb-no-print" href="([^"]+)"/)?.[1] ?? '').replaceAll('&#x26;', '&');

test('typescript opens the TS Playground with the code compressed by lz-string, from the title bar', async () => {
  const code = "const greeting: string = 'hello';\nconsole.log(greeting);";
  const { html, warnings } = await render(block('ts playground="typescript"', ...code.split('\n')));
  expect(href(html)).toBe(`https://www.typescriptlang.org/play#code/${LZString.compressToEncodedURIComponent(code)}`);
  expect(html).toContain(
    'target="_blank" rel="noopener">Open in TS Playground<span class="scb-sr-only"> (opens in a new tab)</span></a>',
  );
  expect(html).toMatch(
    /<figcaption class="header"><span class="scb-tools"><a class="scb-btn scb-playground scb-no-print"/,
  );
  expect(warnings).toEqual([]);
});

test('rust opens the Rust Playground with the copied text in the URL: directives removed, hidden lines kept', async () => {
  const { html, copyText } = await render(
    block(
      'rust playground="rust" hidden={1}',
      'use std::fmt;',
      'fn main() {',
      '    println!("hi & bye"); // [!code focus]',
      '}',
    ),
  );
  const code = 'use std::fmt;\nfn main() {\n    println!("hi & bye");\n}';
  expect(href(html)).toBe(
    `https://play.rust-lang.org/?version=stable&mode=debug&edition=2024&code=${encodeURIComponent(code)}`,
  );
  expect(copyText).toBe(code);
  expect(html).toContain('Open in Rust Playground');
});

test('shares the title bar controls with hidden lines', async () => {
  const { html } = await render(block('ts title="a.ts" playground="typescript" hidden={1}', 'let a = 1;', 'a++;'));
  expect(html).toMatch(
    /<span class="scb-tools"><button[^>]*scb-hidden-toggle[^>]*>[^<]*<\/button><a class="scb-btn scb-playground scb-no-print"/,
  );
});

test('a custom url playground gets the code, the language and the title, and only the commands of a session', async () => {
  const seen: unknown[] = [];
  const playgrounds = {
    sandbox: {
      label: 'Try in Sandbox',
      url: (input: { code: string }) => {
        seen.push(input);
        return `https://sandbox.example.com/?c=${encodeURIComponent(input.code)}`;
      },
    },
  };
  const { html } = await render(block('py title="median.py" playground="sandbox"', 'print(1)'), { playgrounds });
  expect(seen).toEqual([{ code: 'print(1)', lang: 'py', title: 'median.py' }]);
  expect(html).toContain('>Try in Sandbox<');
  expect(href((await render(block('sh playground="sandbox"', '$ ls', 'a.txt'), { playgrounds })).html)).toBe(
    'https://sandbox.example.com/?c=ls',
  );
});

test('a post playground renders a form with hidden fields that opens a new tab', async () => {
  const { html } = await render(block('js playground="blitz"', 'console.log(1)'), {
    playgrounds: {
      blitz: {
        label: 'Open in StackBlitz',
        post: ({ code }) => ({ action: 'https://stackblitz.com/run', fields: { 'project[files][index.js]': code } }),
      },
    },
  });
  expect(html).toContain(
    '<form class="scb-playground scb-no-print" method="post" action="https://stackblitz.com/run" target="_blank"><input type="hidden" name="project[files][index.js]" value="console.log(1)"><button type="submit" class="scb-btn">Open in StackBlitz',
  );
});

test('a custom playground can replace a built-in one', async () => {
  const { html } = await render(block('ts playground="typescript"', 'let a = 1;'), {
    playgrounds: { typescript: { label: 'Our TS sandbox', url: () => 'https://example.com/ts' } },
  });
  expect(href(html)).toBe('https://example.com/ts');
});

test('warns about an unknown playground, including Object.prototype names, and adds no button', async () => {
  const { html, warnings } = await render(block('ts playground="nope"', 'let a = 1;'));
  expect(html).not.toContain('scb-playground');
  expect(warnings).toEqual([
    'src/content/docs/example.md, ts code block: `playground="nope"` is not a known playground. Known playgrounds: typescript, rust.',
  ]);
  const proto = await render(block('ts playground="constructor"', 'let a = 1;'));
  expect(proto.warnings.join('\n')).toContain('is not a known playground');
});

test('warns when the URL is longer than 8,000 characters', async () => {
  const lines = Array.from({ length: 400 }, (_, i) => `println!("line ${i}");`);
  const { warnings } = await render(block('rust playground="rust"', ...lines));
  expect(warnings[0]).toMatch(/the "rust" playground URL is \d+ characters long/);
});

test('renders a block without playground= the same as without the feature', async () => {
  const md = block('ts title="a.ts"', 'let a = 1;');
  expect((await render(md)).html).toBe((await render(md, { playgrounds: false })).html);
});
