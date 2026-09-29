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
  const out = scrollycoding([html, ...steps].join('\n'), { interactive });
  const tree = fromHtml(out, { fragment: true });
  const outLines = (selector: string) =>
    selectAll(`${selector} .ec-line`, tree).map((line) => (line.properties.className as string[]).join(' '));
  return { out, tree, outLines };
}

const steps = [
  step(' data-focus="1"', 'Import Express.'),
  step(' data-focus="3-4" data-mark="4"', '<p>Create and <code>listen</code>.</p>'),
];

test('puts the Markdown of each step and a copy of the block, focused for the step, after each step', async () => {
  const { out, tree, outLines } = await build(steps);
  expect(selectAll('.scb-scrolly-step', tree)).toHaveLength(2);
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
  expect(out).toContain(
    '<div class="scb-scrolly-step" data-scb-focus="2,3" data-scb-mark="3"><div class="scb-scrolly-text"><p>Create and <code>listen</code>.</p></div><div class="expressive-code">',
  );
  const texts = [...out.matchAll(/data-code="([^"]*)"/g)].map((m) => m[1]);
  expect(texts).toHaveLength(3);
  expect(new Set(texts).size).toBe(1);
  expect(texts[0]).toContain('app.listen(3000);');
});

test('adds a sticky copy in the state of the first step, and marks the first step as active', async () => {
  const { out, outLines } = await build(steps);
  expect(out).toMatch(/^<div class="scb-scrolly scb-scrolly-600" data-scb-scrolly=""><div class="scb-scrolly-grid">/);
  expect(out).toContain('class="scb-scrolly-step scb-scrolly-on" data-scb-focus="0" data-scb-mark=""');
  expect(outLines('.scb-scrolly-code')).toEqual(outLines('.scb-scrolly-step:nth-child(1)'));
  expect(out).toContain('<figure class="frame has-title scb-scrolly-frame">');
  expect(out.match(/<code tabindex="0" role="region" aria-label="Code block">/g)).toHaveLength(3);
  expect(out).not.toContain('<script');
  expect(out).not.toContain('data-scb-version');
});

test('a step replaces a focus from the fence line, keeps its marks, and with no focus leaves every line clear', async () => {
  expect((await build(steps, 'focus={4}')).outLines('.scb-scrolly-step:nth-child(1)')[0]).toBe('ec-line');
  const { tree } = await build(steps, '{2}');
  const [sticky] = selectAll('.scb-scrolly-code > .expressive-code', tree);
  expect(sticky.properties.dataScbMarked).toBe('1');
  const { outLines } = await build([step('', 'All of it.')]);
  expect(outLines('.scb-scrolly-step')).toEqual(['ec-line', 'ec-line', 'ec-line', 'ec-line']);
});

test('with the feature off, renders the copies only, with no sticky copy', async () => {
  const { out } = await build(steps, '', false);
  expect(out).toMatch(/^<div class="scb-scrolly scb-scrolly-600"><div class="scb-scrolly-grid">/);
  expect(out).not.toContain('scb-scrolly-code');
});

test('fails the build for a range that is not valid, or without one block and a step', async () => {
  await expect(build([step(' data-focus="4-2"', 'x')])).rejects.toThrow(
    '<Step focus="4-2"> in <Scrollycoding>: 4-2 ends before it starts.',
  );
  const { html } = await render(code.join('\n'));
  expect(() => scrollycoding(html)).toThrow('needs a code block, then one or more <Step> components');
  expect(() => scrollycoding([steps[0], html, steps[1]].join(''))).toThrow('does not start with a code block');
  expect(() => scrollycoding([html, steps[0], html].join(''))).toThrow('end with a step');
  expect(() => scrollycoding([html, html, steps[0]].join(''))).toThrow('follow each code block with a step');
  expect(() => scrollycoding([html, '<p>Intro</p>', steps[0]].join(''))).toThrow('but it has a <p>');
  expect(() => scrollycoding([html, 'Loose text', steps[0]].join(''))).toThrow('the text "Loose text"');
});

test('gives each copy its own ids, and points its references at them', async () => {
  const { html } = await render(
    [
      '```js id="cfg" footnotes="static"',
      'a() // [!annotate] Calls `a`.',
      '// [!ref] Calls `b`.',
      'b()',
      'c() // [!code hide]',
      'd() // [!code hide]',
      'e()',
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
    const list = [p.ariaControls, p.popoverTarget].flatMap((v) =>
      v === undefined ? [] : Array.isArray(v) ? v.map(String) : String(v).split(/\s+/),
    );
    return [...hash, ...list];
  });
  expect(refs.length).toBeGreaterThan(10);
  expect(out).not.toMatch(/aria-controls="[^"]*,/);
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

const version2 = [
  '```js title="server.js"',
  "import express from 'express';",
  '',
  'const app = express();',
  'app.use(express.json());',
  'app.listen(3000);',
  '```',
];

test('a block between steps is the code from the next step on, with a sticky copy of each version', async () => {
  const { html: first } = await render(code.join('\n'));
  const { html: second } = await render(version2.join('\n'));
  const out = scrollycoding([first, steps[0], second, step(' data-focus="5"', 'Parse JSON.')].join('\n'));
  const tree = fromHtml(out, { fragment: true });
  const [one, two] = selectAll('.scb-scrolly-step', tree);
  expect(one?.properties.dataScbVersion).toBe('0');
  expect(two?.properties.dataScbVersion).toBe('1');
  expect(selectAll('.ec-line', two as never)).toHaveLength(5);
  expect(two?.properties.dataScbFocus).toBe('4');
  const sticky = selectAll('.scb-scrolly-code > .expressive-code', tree);
  expect(sticky.map((g) => (g.properties.className as string[]).includes('scb-scrolly-current'))).toEqual([
    true,
    false,
  ]);
  const data = JSON.parse(out.match(/<script type="application\/json">(.*?)<\/script>/)?.[1] ?? '');
  expect(data).toHaveLength(2);
  // A token in both versions has the same key.
  const key = (i: number, text: string) => data[i].find((t: [number, string]) => t[1] === text)?.[0];
  expect(key(0, 'listen')).toBe(key(1, 'listen'));
  expect(scrollycoding([first, steps[0], second, steps[1]].join('\n'), { animate: false })).not.toContain('<script');
  // The wide layout hides the step copies, so screen readers get each version as text where it starts.
  const spoken = selectAll('.scb-scrolly-spoken pre', tree).map((pre) =>
    pre.children.map((c) => ('value' in c ? c.value : '')).join(''),
  );
  expect(spoken).toEqual([code.slice(1, -1).join('\n'), version2.slice(1, -1).join('\n')]);
});

test('needs a wider container for the columns when the lines are longer, and can put the code on the left', async () => {
  const { html } = await render(['```js', `const x = ${'1'.repeat(40)};`, '```'].join('\n'));
  const out = scrollycoding([html, steps[0]].join('\n'), { codeSide: 'left' });
  expect(out).toMatch(/^<div class="scb-scrolly scb-scrolly-800 scb-scrolly-code-left"/);
});
