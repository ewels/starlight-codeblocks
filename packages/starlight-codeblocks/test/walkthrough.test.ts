import { type ExpressiveCodePlugin, getColorContrast, setAlpha } from '@expressive-code/core';
import { pluginCollapsibleSections } from '@expressive-code/plugin-collapsible-sections';
import { expect, test } from 'vitest';
import { toMs } from '../src/components/animate.ts';
import { codeWalkthrough, type StepTokens } from '../src/components/steps.ts';
import { pluginWalkthrough } from '../src/expressive-code/walkthrough.ts';
import { variants } from './contrast.ts';
import { baseStyles, render, styleVariants } from './render.ts';

const block = (meta: string, code: string) => [`\`\`\`js ${meta}`, code, '```'].join('\n');

const steps = [
  block('title="server.js" step="Create the app"', 'const app = express();\n\napp.listen(3000);'),
  block(
    'title="server.js" step="Parse JSON bodies"',
    'const app = express();\napp.use(express.json());\n\napp.listen(3000);',
  ),
  block('title="server.js"', 'app.listen(3000);'),
];

async function renderSteps(blocks = steps, plugins: ExpressiveCodePlugin[] = []) {
  const rendered = await Promise.all(blocks.map((b) => render(b, {}, plugins)));
  const html = codeWalkthrough(rendered.map((r) => r.rawHtml).join('\n'))
    .replaceAll(' scb-deco', '')
    .replace(/ data-pagefind-ignore(="")?/g, '');
  const data = JSON.parse(html.match(/<script type="application\/json">(.*?)<\/script>/)?.[1] ?? '[]') as StepTokens[];
  return { html, data, rendered };
}

test('the plugin shows the step label after the title, or first without one, even with the feature off', async () => {
  const { html, copyText } = await render(steps[0]);
  expect(html).toContain(
    '<span class="title">server.js</span><span class="scb-steps-head"><span class="scb-steps-label">Create the app</span></span>',
  );
  expect(copyText).toBe('const app = express();\n\napp.listen(3000);');
  expect((await render(block('step="Start"', 'a()'))).html).toContain(
    '<figcaption class="header"><span class="scb-steps-head"><span class="scb-steps-label">Start</span>',
  );
  expect((await render(steps[0], { walkthrough: false })).html).toContain(
    '<span class="scb-steps-label">Create the app</span>',
  );
});

test('a block without step renders the same with the feature off', async () => {
  const md = block('title="a.js"', 'a()');
  expect((await render(md)).html).toBe((await render(md, { walkthrough: false })).html);
});

test('adds numbered steps and Previous and Next to each title bar, with the first step current', async () => {
  const { html, rendered } = await renderSteps();
  const bars = html.split('<figcaption').slice(1);
  expect(bars).toHaveLength(3);
  expect(bars[0]).toContain('role="group" aria-label="Steps"');
  expect(bars[0]).toContain('aria-label="Step 1: Create the app" aria-current="step">1</button>');
  expect(bars[1]).toContain(
    '<button type="button" class="scb-steps-dot scb-steps-done" data-scb-steps-go="0" aria-label="Step 1: Create the app">1</button><span class="scb-steps-line scb-steps-done" aria-hidden="true"></span>',
  );
  expect(bars[1]).toContain('aria-label="Step 2: Parse JSON bodies" aria-current="step">2</button>');
  expect(bars[1]).toContain(
    '<span class="scb-steps-line" aria-hidden="true"></span><button type="button" class="scb-steps-dot" data-scb-steps-go="2" aria-label="Step 3">3</button>',
  );
  const nav = (bar: string, go: string) =>
    bar.match(new RegExp(`<button[^>]*data-scb-steps-go="${go}"[^>]*>`))?.[0] ?? '';
  expect(nav(bars[0], 'prev')).toContain('disabled');
  expect(nav(bars[0], 'next')).not.toContain('disabled');
  expect(nav(bars[1], 'prev')).not.toContain('disabled');
  expect(nav(bars[2], 'next')).toContain('disabled');
  expect(nav(bars[0], 'next')).toContain('aria-label="Next"');
  expect(bars[0]).toContain('<span class="scb-steps-nav-text">Previous</span>');
  expect(html).toMatch(/^<div class="scb-steps" data-scb-steps><div class="expressive-code scb-steps-current">/);
  expect(html.match(/scb-steps-current/g)).toHaveLength(1);
  expect(html).toContain('aria-live="polite"');
  expect(rendered.map((r) => r.copyText)).toEqual([
    'const app = express();\n\napp.listen(3000);',
    'const app = express();\napp.use(express.json());\n\napp.listen(3000);',
    'app.listen(3000);',
  ]);
});

test('serialises the tokens of each step with the colours of both themes, and unchanged tokens keep their keys', async () => {
  const { data } = await renderSteps();
  expect(data).toHaveLength(3);
  const text = (step: StepTokens) => step.map(([, content]) => content).join('');
  expect(text(data[0])).toBe('const app = express();\n\napp.listen(3000);\n');
  expect(text(data[1])).toBe('const app = express();\napp.use(express.json());\n\napp.listen(3000);\n');
  const listen = data[0].find(([, content]) => content === 'listen');
  expect(listen?.[2]).toMatch(/^--0:#[0-9A-F]{6};--1:#[0-9A-F]{6}$/i);
  const key = (step: StepTokens, content: string) => step.filter(([, c]) => c === content).map(([k]) => k);
  expect(key(data[1], 'listen')).toEqual(key(data[0], 'listen'));
  expect(key(data[2], 'listen')).toEqual(key(data[0], 'listen'));
  expect(key(data[1], 'use')[0]).not.toBeUndefined();
  expect(data[0].map(([k]) => k)).not.toContain(key(data[1], 'use')[0]);
});

test('a step that repeats an earlier step has no duplicate keys', async () => {
  const x = '{\nbar()\nx = 1\n{\nfoo(x)\n{\nx = 1';
  const { data } = await renderSteps([
    block('', x),
    block('', 'foo(x)\n  return x\n{\n}\nbar()\nfoo(x)'),
    block('', x),
  ]);
  for (const step of data) {
    const keys = step.map(([k]) => k);
    expect(new Set(keys).size).toBe(keys.length);
  }
});

test('leaves out decorations, hidden lines and the lines of a closed section', async () => {
  const { data } = await renderSteps(
    [
      block('', 'a() // [!code error] Fails'),
      block('hidden={1}', 'a()\nb()'),
      block('collapse={2-3}', 'a()\nb()\nc()\nd()'),
    ],
    [pluginCollapsibleSections()],
  );
  expect(data.map((step) => step.map(([, c]) => c).join(''))).toEqual(['a()\n', 'b()\n', 'a()\nd()\n']);
});

test('a block nested in other markup is not a step, and HTML without a code block stays as it is', async () => {
  const rendered = await Promise.all(steps.slice(0, 2).map((b) => render(b)));
  const html = codeWalkthrough(`${rendered[0].rawHtml}<div>${rendered[1].rawHtml}</div>`);
  expect(html.match(/scb-steps-dot/g)).toHaveLength(1);
  expect(codeWalkthrough('<p>Text</p>')).toBe('<p>Text</p>');
});

test("the step colours meet their contrast targets, and a new line takes the theme's terminal green", async () => {
  for (const { get, name } of await variants()) {
    const bg = get('codeBackground');
    expect(getColorContrast(get('codeblocksWalkthrough.stepBorder'), bg), name).toBeGreaterThanOrEqual(3);
    expect(getColorContrast(get('codeblocksWalkthrough.doneForeground'), bg), name).toBeGreaterThanOrEqual(4.5);
  }
  const resolved = await styleVariants();
  expect(resolved.map((v) => v.resolvedStyleSettings.get('codeblocksWalkthrough.themeIndex' as never))).toEqual([
    '0',
    '1',
  ]);
  for (const v of resolved) {
    const green = v.theme.colors['terminal.ansiGreen'] as string;
    expect(green).toBeTruthy();
    expect(v.resolvedStyleSettings.get('codeblocksWalkthrough.newLineBackground' as never)).toBe(setAlpha(green, 0.3));
  }
  expect(await baseStyles()).toContain('@keyframes scb-steps-new');
});

test('the label hides next to the stepper in a narrow container, not in a narrow window', () => {
  const css = String((pluginWalkthrough().baseStyles as (c: unknown) => string)({ cssVar: (k: string) => k }));
  expect(css).not.toMatch(/@media[^{]*max-width/);
  expect(css).toMatch(
    /@container \(max-width: 480px\) \{\s*\.scb-steps-head:has\(> \.scb-steps-stepper\) > \.scb-steps-label \{ display: none; \}/,
  );
});

test('the animation reads the duration as a CSS time', () => {
  expect(toMs('480ms', 1)).toBe(480);
  expect(toMs(' 0.6s', 1)).toBe(600);
  expect(toMs('0ms', 1)).toBe(0);
  expect(toMs('', 480)).toBe(480);
});
