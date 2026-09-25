import { toHtml } from '@expressive-code/core/hast';
import { expect, test } from 'vitest';
import { inlineMarkdown } from '../src/expressive-code/inline-markdown.ts';

const html = (text: string) => toHtml(inlineMarkdown(text));

test.each([
  ['Returns `null` here', 'Returns <code>null</code> here'],
  ['Read **the guide** first', 'Read <strong>the guide</strong> first'],
  ['See [the docs](/reference/options/)', 'See <a href="/reference/options/">the docs</a>'],
  ['See [**bold** link](https://example.com)', 'See <a href="https://example.com"><strong>bold</strong> link</a>'],
  ['<b>not HTML</b> and _not_ *emphasis*', '&#x3C;b>not HTML&#x3C;/b> and _not_ *emphasis*'],
  ['[bad](javascript:alert(1))', '[bad](javascript:alert(1))'],
])('renders %j', (text, expected) => {
  expect(html(text)).toBe(expected);
});
