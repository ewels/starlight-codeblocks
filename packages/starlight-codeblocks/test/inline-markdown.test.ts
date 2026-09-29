import { toHtml } from '@expressive-code/core/hast';
import { expect, test } from 'vitest';
import { inlineMarkdown } from '../src/expressive-code/inline-markdown.ts';

test('renders code, bold and safe links only', () => {
  const cases = [
    ['Returns `null` here', 'Returns <code>null</code> here'],
    ['Read **the guide** first', 'Read <strong>the guide</strong> first'],
    ['See [**bold** link](https://example.com)', 'See <a href="https://example.com"><strong>bold</strong> link</a>'],
    ['[mail](mailto:a@b.c)', '<a href="mailto:a@b.c">mail</a>'],
    ['<b>not HTML</b> and _not_ *emphasis*', '&#x3C;b>not HTML&#x3C;/b> and _not_ *emphasis*'],
    ['[bad](javascript:alert(1))', '[bad](javascript:alert(1))'],
    ['[bad](data:text/html,x)', '[bad](data:text/html,x)'],
  ];
  for (const [text, expected] of cases) expect(toHtml(inlineMarkdown(text)), text).toBe(expected);
});
