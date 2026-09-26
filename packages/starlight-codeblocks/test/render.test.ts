import { toHtml } from '@expressive-code/core/hast';
import { ExpressiveCode } from 'expressive-code';
import { expect, test } from 'vitest';
import { pluginCodeblocks } from '../src/expressive-code/index.ts';
import { render } from './render.ts';

test('renders a code block with the plugin and returns the copied text', async () => {
  const { html, copyText } = await render(['```js title="app.js"', 'const a = 1', 'console.log(a)', '```'].join('\n'));
  expect(html).toContain('class="expressive-code"');
  expect(html).toContain('app.js');
  expect(copyText).toBe('const a = 1\nconsole.log(a)');
});

test('renders the same ids in every build', async () => {
  const md = [
    '```py',
    'import os  # [!annotate] Imports `os`.',
    '# [!ref] Creates `app`.',
    'app = 1',
    'x = 2  # [!code hide]',
    'y = 3',
    '```',
  ].join('\n');
  const first = await render(md);
  expect(first.html).toMatch(/id="scb-annotation-/);
  expect(first.html).toMatch(/id="scb-fn-/);
  expect(first.html).toMatch(/id="scb-hidden-/);
  expect((await render(md)).html).toBe(first.html);
  const ec = new ExpressiveCode({ plugins: [pluginCodeblocks()] });
  const ids = async () => {
    const { renderedGroupAst } = await ec.render({ code: md.split('\n').slice(1, -1).join('\n'), language: 'py' });
    return toHtml(renderedGroupAst).match(/id="[^"]+"/g);
  };
  expect(await ids()).not.toEqual(await ids());
});
