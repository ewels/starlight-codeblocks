import { expect, test } from 'vitest';
import { render } from './render.ts';

test('renders a code block with the plugin and returns the copied text', async () => {
  const { html, copyText } = await render(['```js title="app.js"', 'const a = 1', 'console.log(a)', '```'].join('\n'));
  expect(html).toContain('class="expressive-code"');
  expect(html).toContain('app.js');
  expect(copyText).toBe('const a = 1\nconsole.log(a)');
});
