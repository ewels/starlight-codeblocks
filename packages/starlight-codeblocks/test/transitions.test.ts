import { getColorContrast } from '@expressive-code/core';
import { ExpressiveCode } from 'expressive-code';
import { expect, test } from 'vitest';
import { codeSteps, type StepTokens } from '../src/components/steps.ts';
import { pluginCodeblocks } from '../src/expressive-code/index.ts';
import { pluginTransitions } from '../src/expressive-code/transitions.ts';
import { render } from './render.ts';

const block = (meta: string, code: string) => [`\`\`\`js ${meta}`, code, '```'].join('\n');

const steps = [
  block('title="server.js" step="Create the app"', 'const app = express();\n\napp.listen(3000);'),
  block(
    'title="server.js" step="Parse JSON bodies"',
    'const app = express();\napp.use(express.json());\n\napp.listen(3000);',
  ),
  block('title="server.js"', 'app.listen(3000);'),
];

async function renderSteps(blocks = steps) {
  const rendered = await Promise.all(blocks.map((b) => render(b)));
  const html = codeSteps(rendered.map((r) => r.html).join('\n'));
  const data = JSON.parse(html.match(/<script type="application\/json">(.*?)<\/script>/)?.[1] ?? '[]') as StepTokens[];
  return { html, data, rendered };
}

test('the plugin shows the step label after the title', async () => {
  const { html, copyText } = await render(steps[0]);
  expect(html).toContain(
    '<span class="title">server.js</span><span class="scb-steps-head"><span class="scb-steps-label">Create the app</span></span>',
  );
  expect(copyText).toBe('const app = express();\n\napp.listen(3000);');
});

test('the plugin puts the label first in a block with no title', async () => {
  const { html } = await render(block('step="Start"', 'a()'));
  expect(html).toContain(
    '<figcaption class="header"><span class="scb-steps-head"><span class="scb-steps-label">Start</span>',
  );
});

test('a block without step renders the same with the feature off', async () => {
  const md = block('title="a.js"', 'a()');
  expect((await render(md)).html).toBe((await render(md, { transitions: false })).html);
});

test('adds numbered steps, with the current step marked, to each title bar', async () => {
  const { html } = await renderSteps();
  const bars = html.split('<figcaption').slice(1);
  expect(bars).toHaveLength(3);
  expect(bars[0]).toContain('aria-label="Step 1: Create the app" aria-current="step">1</button>');
  expect(bars[1]).toContain(
    '<button type="button" class="scb-steps-dot scb-steps-done" data-scb-steps-go="0" aria-label="Step 1: Create the app">1</button><span class="scb-steps-line scb-steps-done" aria-hidden="true"></span>',
  );
  expect(bars[1]).toContain('aria-label="Step 2: Parse JSON bodies" aria-current="step">2</button>');
  expect(bars[1]).toContain(
    '<span class="scb-steps-line" aria-hidden="true"></span><button type="button" class="scb-steps-dot" data-scb-steps-go="2" aria-label="Step 3">3</button>',
  );
  expect(bars[0]).toContain('role="group" aria-label="Steps"');
});

test('adds Previous and Next, off on the first and the last step', async () => {
  const { html } = await renderSteps();
  const bars = html.split('<figcaption').slice(1);
  const nav = (bar: string, go: string) =>
    bar.match(new RegExp(`<button[^>]*data-scb-steps-go="${go}"[^>]*>`))?.[0] ?? '';
  expect(nav(bars[0], 'prev')).toContain('disabled');
  expect(nav(bars[0], 'next')).not.toContain('disabled');
  expect(nav(bars[1], 'prev')).not.toContain('disabled');
  expect(nav(bars[2], 'next')).toContain('disabled');
  expect(nav(bars[0], 'next')).toContain('aria-label="Next"');
  expect(bars[0]).toContain('<span class="scb-steps-nav-text">Previous</span>');
});

test('marks the first step as current, and keeps each copy button', async () => {
  const { html, rendered } = await renderSteps();
  expect(html).toMatch(/^<div class="scb-steps" data-scb-steps><div class="expressive-code scb-steps-current">/);
  expect(html.match(/scb-steps-current/g)).toHaveLength(1);
  expect(html).toContain('aria-live="polite"');
  expect(rendered.map((r) => r.copyText)).toEqual([
    'const app = express();\n\napp.listen(3000);',
    'const app = express();\napp.use(express.json());\n\napp.listen(3000);',
    'app.listen(3000);',
  ]);
});

test('serialises the tokens of each step, with the colours of both themes', async () => {
  const { data } = await renderSteps();
  expect(data).toHaveLength(3);
  const text = (step: StepTokens) => step.map(([, content]) => content).join('');
  expect(text(data[0])).toBe('const app = express();\n\napp.listen(3000);\n');
  expect(text(data[1])).toBe('const app = express();\napp.use(express.json());\n\napp.listen(3000);\n');
  const listen = data[0].find(([, content]) => content === 'listen');
  expect(listen?.[2]).toMatch(/^--0:#[0-9A-F]{6};--1:#[0-9A-F]{6}$/i);
});

test('unchanged tokens keep their keys from step to step', async () => {
  const { data } = await renderSteps();
  const key = (step: StepTokens, content: string) => step.filter(([, c]) => c === content).map(([k]) => k);
  expect(key(data[1], 'listen')).toEqual(key(data[0], 'listen'));
  expect(key(data[2], 'listen')).toEqual(key(data[0], 'listen'));
  expect(key(data[1], 'use')[0]).not.toBeUndefined();
  expect(data[0].map(([k]) => k)).not.toContain(key(data[1], 'use')[0]);
});

test('leaves out decorations, such as line state labels', async () => {
  const { data } = await renderSteps([block('', 'a() // [!code error] Fails'), block('', 'b()')]);
  expect(data[0].map(([, c]) => c).join('')).toBe('a()\n');
});

test('returns the HTML as it is when there is no code block', () => {
  expect(codeSteps('<p>Text</p>')).toBe('<p>Text</p>');
});

test('the step colours meet their contrast targets', async () => {
  const ec = new ExpressiveCode({ plugins: pluginCodeblocks() });
  await ec.getBaseStyles();
  const backgrounds = { dark: ['#23262f', '#24292e'], light: ['#f6f7f9', '#ffffff'] };
  for (const v of ec.styleVariants) {
    const get = (key: string) => v.resolvedStyleSettings.get(key as never) as string;
    for (const bg of backgrounds[v.theme.type]) {
      expect(getColorContrast(get('codeblocksTransitions.stepBorder'), bg)).toBeGreaterThanOrEqual(3);
      expect(getColorContrast(get('codeblocksTransitions.doneForeground'), bg)).toBeGreaterThanOrEqual(4.5);
    }
  }
  expect(ec.styleVariants.map((v) => v.resolvedStyleSettings.get('codeblocksTransitions.themeIndex' as never))).toEqual(
    ['0', '1'],
  );
});

test('with the feature off, the plugin still shows the step label after the title', async () => {
  const { html } = await render(steps[0], { transitions: false });
  expect(html).toContain('<span class="scb-steps-label">Create the app</span>');
});

test('the label hides next to the stepper in a narrow container, not in a narrow window', () => {
  const css = String((pluginTransitions().baseStyles as (c: unknown) => string)({ cssVar: (k: string) => k }));
  expect(css).not.toMatch(/@media[^{]*max-width/);
  expect(css).toMatch(
    /@container \(max-width: 640px\) \{\s*\.scb-steps-head:has\(> \.scb-steps-stepper\) > \.scb-steps-label \{ display: none; \}/,
  );
});
