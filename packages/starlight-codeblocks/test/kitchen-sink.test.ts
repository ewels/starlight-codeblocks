import { expect, test } from 'vitest';
import { block, lineClasses, render } from './render.ts';

const everything = block(
  'js title="server.js" placeholder="YOUR_API_KEY" hidden={1} focus={4-10} apiLinks=false',
  "import 'dotenv/config';",
  "import express from 'express';",
  '',
  'const app = express();',
  'app.use(express.json()); // [!code ++] Parse JSON bodies [!annotate] Before any route.',
  '// [!callout /x-api-key/] Checked on every request',
  "app.use((req, res, next) => (req.get('x-api-key') === 'YOUR_API_KEY' ? next() : res.sendStatus(401)));",
  '// [!ref] Load balancers call this route.',
  "app.get('/health', (req, res) => { // [!mention health]",
  '  res.json({ ok: true }); // [!code success highlight] Always 200 [!mention health]',
  '});',
  'app.listen(3000); // [!code focus warning] Hard-coded port',
);

test('every feature in one block keeps its own effect', async () => {
  const { html, copyText, warnings } = await render(everything);
  expect(warnings).toEqual([]);
  expect(copyText).toBe(
    [
      "import 'dotenv/config';",
      "import express from 'express';",
      '',
      'const app = express();',
      'app.use(express.json());',
      "app.use((req, res, next) => (req.get('x-api-key') === 'YOUR_API_KEY' ? next() : res.sendStatus(401)));",
      "app.get('/health', (req, res) => {",
      '  res.json({ ok: true });',
      '});',
      'app.listen(3000);',
    ].join('\n'),
  );
  const lines = lineClasses(html) ?? [];
  expect(lines).toHaveLength(10);
  expect(lines[0]).toContain('scb-hidden');
  expect(lines[2]).toContain('scb-focus-out');
  expect(lines[4]).toMatch(/\bins\b/);
  expect(lines[4]).not.toContain('scb-focus-out');
  expect(lines[7]).toContain('scb-state-success');
  expect(lines[7]).toMatch(/\bmark\b/);
  expect(lines[9]).toContain('scb-state-warning');
  expect(lines[9]).not.toContain('scb-focus-out');
  for (const part of [
    'Parse JSON bodies',
    'Before any route.',
    'Checked on every request',
    'Load balancers call this route.',
    'Always 200',
    'Hard-coded port',
    'data-scb-mention="health"',
    'data-scb-placeholder',
  ]) {
    expect(html).toContain(part);
  }
});

test('one comment holds a multi-name directive and an annotation', async () => {
  const one = await render(block('js', 'a() // [!code focus ++] New [!annotate] Why'));
  const code = one.html.match(/<code[\s\S]*<\/code>/)?.[0];
  expect(one.warnings).toEqual([]);
  expect(lineClasses(one.html)).toEqual(['ec-line highlight ins']);
  expect(code).toContain('New');
  expect(code).toContain('Why');
});
