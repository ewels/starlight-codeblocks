import { toHtml } from '@expressive-code/core/hast';
import { ExpressiveCode } from 'expressive-code';
import { expect, test } from 'vitest';
import { pluginCodeblocks } from '../src/expressive-code/index.ts';
import { block, render } from './render.ts';

test('renders the same ids in every build', async () => {
  const lines = [
    'import os  # [!annotate] Imports `os`.',
    '# [!ref] Creates `app`.',
    'app = 1',
    'x = 2  # [!code hide]',
  ];
  const first = await render(block('py', ...lines));
  expect(first.html).toMatch(/id="scb-annotation-/);
  expect(first.html).toMatch(/id="scb-fn-/);
  expect(first.html).toMatch(/id="scb-hidden-/);
  expect((await render(block('py', ...lines))).html).toBe(first.html);
  const ec = new ExpressiveCode({ plugins: [pluginCodeblocks()] });
  const ids = async () =>
    toHtml((await ec.render({ code: lines.join('\n'), language: 'py' })).renderedGroupAst).match(/id="[^"]+"/g);
  expect(await ids()).not.toEqual(await ids());
});
