import { selectAll } from '@expressive-code/core/hast';
import { fromHtml } from 'hast-util-from-html';
import { expect, test } from 'vitest';
import { scrollycoding } from '../src/components/scrolly.ts';
import { render } from './render.ts';

const code = [
  '```js title="server.js"',
  "import express from 'express';",
  '',
  'const app = express();',
  'app.listen(3000);',
  '```',
];
const step = (attrs: string, text: string) => `<div class="scb-scrolly-step"${attrs}>${text}</div>`;

async function build(steps: string[], meta = '', interactive = true) {
  const { html } = await render(code.join('\n').replace('title="server.js"', `title="server.js" ${meta}`));
  const out = scrollycoding([html, ...steps].join('\n'), interactive);
  const tree = fromHtml(out, { fragment: true });
  const outLines = (selector: string) =>
    selectAll(`${selector} .ec-line`, tree).map((line) => (line.properties.className as string[]).join(' '));
  return { out, tree, outLines };
}

const steps = [
  step(' data-focus="1"', 'Import Express.'),
  step(' data-focus="3-4" data-mark="4"', '<p>Create and <code>listen</code>.</p>'),
];

test('puts a copy of the block, focused for the step, after each step', async () => {
  const { tree, outLines } = await build(steps);
  const copies = selectAll('.scb-scrolly-step', tree);
  expect(copies).toHaveLength(2);
  expect(outLines('.scb-scrolly-step:nth-child(1)')).toEqual([
    'ec-line',
    'ec-line scb-focus-out',
    'ec-line scb-focus-out',
    'ec-line scb-focus-out',
  ]);
  expect(outLines('.scb-scrolly-step:nth-child(2)')).toEqual([
    'ec-line scb-focus-out',
    'ec-line scb-focus-out',
    'ec-line',
    'ec-line mark',
  ]);
});

test('keeps the Markdown of each step before its copy', async () => {
  const { out } = await build(steps);
  expect(out).toContain(
    '<div class="scb-scrolly-step" data-scb-focus="2,3" data-scb-mark="3"><div class="scb-scrolly-text"><p>Create and <code>listen</code>.</p></div><div class="expressive-code">',
  );
});

test('adds a sticky copy in the state of the first step, and marks the first step as active', async () => {
  const { out, outLines } = await build(steps);
  expect(out).toMatch(/^<div class="scb-scrolly" data-scb-scrolly=""><div class="scb-scrolly-grid">/);
  expect(out).toContain('class="scb-scrolly-step scb-scrolly-on" data-scb-focus="0" data-scb-mark=""');
  expect(outLines('.scb-scrolly-code')).toEqual(outLines('.scb-scrolly-step:nth-child(1)'));
  expect(out).toContain('<figure class="frame has-title scb-scrolly-frame">');
  expect(out.match(/<code tabindex="0">/g)).toHaveLength(3);
});

test('each copy keeps the copy text of the whole block', async () => {
  const { out } = await build(steps);
  const texts = [...out.matchAll(/data-code="([^"]*)"/g)].map((m) => m[1]);
  expect(texts).toHaveLength(3);
  expect(new Set(texts).size).toBe(1);
  expect(texts[0]).toContain('app.listen(3000);');
});

test('replaces a focus from the fence line', async () => {
  const { outLines } = await build(steps, 'focus={4}');
  expect(outLines('.scb-scrolly-step:nth-child(1)')[0]).toBe('ec-line');
});

test('a step with no focus leaves every line clear', async () => {
  const { outLines } = await build([step('', 'All of it.')]);
  expect(outLines('.scb-scrolly-step')).toEqual(['ec-line', 'ec-line', 'ec-line', 'ec-line']);
});

test('with the feature off, renders the copies only, with no sticky copy', async () => {
  const { out } = await build(steps, '', false);
  expect(out).toMatch(/^<div class="scb-scrolly"><div class="scb-scrolly-grid">/);
  expect(out).not.toContain('scb-scrolly-code');
});

test('fails the build for a range that is not valid, or without one block and a step', async () => {
  await expect(build([step(' data-focus="4-2"', 'x')])).rejects.toThrow(
    '<Step focus="4-2"> in <Scrollycoding>: 4-2 ends before it starts.',
  );
  const { html } = await render(code.join('\n'));
  expect(() => scrollycoding(html)).toThrow('needs one code block and one or more <Step> components');
  expect(() => scrollycoding([html, html, steps[0]].join(''))).toThrow('It has 2 code blocks and 1 steps.');
});

test('gives each copy its own ids, and points its references at them', async () => {
  const { html } = await render(
    [
      '```js id="cfg" footnotes="static"',
      'a() // [!annotate] Calls `a`.',
      '// [!ref] Calls `b`.',
      'b()',
      'c() // [!code hide]',
      'd()',
      '```',
    ].join('\n'),
  );
  const out = scrollycoding([html, ...steps].join('\n'));
  const tree = fromHtml(out, { fragment: true });
  const ids = selectAll('[id]', tree).map((el) => String(el.properties.id));
  expect(ids.length).toBeGreaterThan(10);
  expect(new Set(ids).size).toBe(ids.length);
  const refs = selectAll('*', tree).flatMap((el) => {
    const p = el.properties;
    const hash = typeof p.href === 'string' && p.href.startsWith('#') ? [p.href.slice(1)] : [];
    const list = [p.ariaControls, p.popoverTarget].flatMap((v) => (v ? String(v).split(/[\s,]+/) : []));
    return [...hash, ...list];
  });
  expect(refs.length).toBeGreaterThan(10);
  for (const ref of refs) expect(ids).toContain(ref);
  const anchors = [...out.matchAll(/(anchor-name|position-anchor):(--[\w-]+)/g)].map((m) => `${m[1]}${m[2]}`);
  expect(new Set(anchors).size).toBe(anchors.length);
  expect(out).toContain('id="cfg-sticky"');
  expect(out).toContain('id="cfg-sticky-L1"');
  expect(out).toContain('href="#cfg-s2-L1"');
});

test('renames the line ids of a block whose id holds regular expression characters', async () => {
  for (const id of ['c++', 'a+b']) {
    const { html } = await render([`\`\`\`js id="${id}"`, 'a()', '```'].join('\n'));
    const out = scrollycoding([html, steps[0]].join('\n'));
    expect(out).toContain(`id="${id}-s1-L1"`);
    expect(out).toContain(`href="#${id}-s1-L1"`);
  }
});
