import { readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { afterEach, expect, test, vi } from 'vitest';
import { type PydocsRegistry, type PydocsSymbol, type PythonAdapterOptions, python } from '../src/adapters/python.ts';
import { readInventory } from '../src/adapters/python-index.ts';
import { resolveOptions } from '../src/options.ts';
import { setRegistry } from '../src/registry.ts';
import { render } from './render.ts';

const block = (fence: string, ...lines: string[]) => [`\`\`\`${fence}`, ...lines, '```'].join('\n');
const withPython = (options: PythonAdapterOptions) => ({ apiLinks: { adapters: [python(options)] } });

const decode = (value?: string) =>
  value?.replace(/&#x([0-9A-F]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)));

/** The linked text and the attributes of each link, in order. */
function links(html: string) {
  return [...html.matchAll(/<a class="scb-api-link" ((?:[^>"]|"[^"]*")*)>(.*?)<\/a>/g)].map(
    ([, attributes = '', inner = '']) => {
      const attribute = (name: string) => decode(attributes.match(new RegExp(`${name}="([^"]*)"`))?.[1]);
      return {
        text: inner.replace(/<[^>]+>/g, ''),
        href: attribute('href'),
        head: attribute('data-scb-api-head'),
        summary: attribute('data-scb-api-summary'),
        source: attribute('data-scb-api-source'),
      };
    },
  );
}
const texts = async (...lines: string[]) => links((await render(block('py', ...lines))).html).map((l) => l.text);

afterEach(() => {
  setRegistry(undefined);
  pydocs(undefined);
  vi.unstubAllGlobals();
});

test('links imports, attribute chains and a method on a new instance, from the standard library', async () => {
  const { html, copyText, warnings } = await render(
    block('py', 'import json', 'from pathlib import Path', '', 'data = json.loads(Path("run.json").read_text())'),
  );
  const docs = 'https://docs.python.org/3/library';
  const source = 'Python 3.14 documentation';
  expect(links(html)).toEqual([
    { text: 'json', href: `${docs}/json.html#module-json`, head: 'module json', source },
    { text: 'pathlib', href: `${docs}/pathlib.html#module-pathlib`, head: 'module pathlib', source },
    { text: 'Path', href: `${docs}/pathlib.html#pathlib.Path`, head: 'class pathlib.Path', source },
    { text: 'json.loads', href: `${docs}/json.html#json.loads`, head: 'function json.loads', source },
    { text: 'Path', href: `${docs}/pathlib.html#pathlib.Path`, head: 'class pathlib.Path', source },
    {
      text: 'read_text',
      href: `${docs}/pathlib.html#pathlib.Path.read_text`,
      head: 'method pathlib.Path.read_text',
      source,
    },
  ]);
  expect(copyText).toBe('import json\nfrom pathlib import Path\n\ndata = json.loads(Path("run.json").read_text())');
  expect(warnings).toEqual([]);
});

test('follows aliases and dotted imports', async () => {
  expect(await texts('import json as j', 'j.loads(s)')).toEqual(['json', 'j.loads']);
  expect(await texts('from json import loads as parse', 'parse(s)')).toEqual(['json', 'loads', 'parse']);
  expect(await texts('import os.path', 'os.path.join(a, b)')).toEqual(['os.path', 'os.path.join']);
  expect(await texts('import os', 'os.path.join(a, b)')).toEqual(['os', 'os.path.join']);
  expect(await texts('from os import (', '    path,', ')', 'path.join(a)')).toEqual(['os', 'path', 'path.join']);
});

test('links the longest part of a chain that it knows', async () => {
  expect(await texts('import json', 'json.missing.loads(s)')).toEqual(['json', 'json']);
});

test('never links names in strings or comments', async () => {
  const lines = [
    'import json',
    '"json.loads"',
    "f'{json.loads(s)}'",
    '# json.loads(s)',
    '"""',
    'json.loads(s)',
    '"""',
    "b'json' + r'\\'json.loads'",
  ];
  expect(await texts(...lines)).toEqual(['json']);
});

test('ends an unclosed one-line string at the end of its line', async () => {
  expect(await texts('x = "open', 'import json', 'json.loads(s)')).toEqual(['json', 'json.loads']);
});

test('leaves names that are not imported, or that the block binds again, as plain text', async () => {
  expect(await texts('loads(s)', 'self.json.loads(s)')).toEqual([]);
  expect(await texts('import json', 'json = {}', 'json.loads(s)')).toEqual(['json']);
  expect(await texts('from pathlib import Path', 'def read(Path):', '    Path.read_text()')).toEqual([
    'pathlib',
    'Path',
  ]);
  expect(await texts('import json', 'for json in items:', '    json.loads(s)')).toEqual(['json']);
  expect(await texts('import json', 'with open(p) as json:', '    json.loads(s)')).toEqual(['json']);
});

test('keeps a comparison or a keyword argument from counting as a new binding only where it must', async () => {
  expect(await texts('import json', 'json == other', 'json.loads(s)')).toEqual(['json', 'json', 'json.loads']);
});

test('guesses a type only after a call to a class', async () => {
  expect(await texts('import json', 'json.loads(s).read_text()')).toEqual(['json', 'json.loads']);
  expect(await texts('from pathlib import Path', 'Path.missing().read_text()')).toEqual(['pathlib', 'Path', 'Path']);
});

test('does nothing with apiLinks=false or in other languages', async () => {
  expect((await render(block('py apiLinks=false', 'import json'))).html).not.toContain('scb-api-link');
  expect((await render(block('js', 'import json'))).html).not.toContain('scb-api-link');
});

const PYDOCS = Symbol.for('starlight-pydocs');
const pydocs = (registry: PydocsRegistry | undefined) => {
  (globalThis as { [PYDOCS]?: PydocsRegistry })[PYDOCS] = registry;
};
const report = { href: '/api/myproject/report/#myproject.report.Report', kind: 'class' } as const;
const myproject = () =>
  new Map<string, PydocsSymbol>([
    ['myproject', { href: '/api/myproject/', kind: 'module', summary: 'Tools to summarise runs.' }],
    [
      'myproject.summarise',
      {
        href: '/api/myproject/#myproject.summarise',
        kind: 'function',
        signature: 'myproject.summarise(data: dict, *, top: int = 5) -> str',
        summary: 'Summarise a run as a short text report.',
      },
    ],
    ['myproject.report.Report', { ...report, signature: 'class myproject.report.Report(title: str)' }],
    // A documented re-export: `Report` is defined in `myproject._report`, a private module.
    ['myproject.Report', { ...report, signature: 'class myproject.report.Report(title: str)' }],
    [
      'myproject.Report.render',
      {
        href: '/api/myproject/report/#myproject.report.Report.render',
        kind: 'method',
        signature: 'Report.render(*, width: int | None = None) -> str',
      },
    ],
  ]);

test('links the objects of a starlight-pydocs package through its registry, with the site base', async () => {
  pydocs({ version: 1, packages: [{ name: 'myproject', base: 'api/myproject', symbols: myproject() }] });
  setRegistry({ options: resolveOptions(), plugins: [], clientAssets: true, base: '/docs' });
  const { html, warnings } = await render(
    block('py', 'from myproject import summarise, Report', 'print(summarise(data))', 'Report("Run").render(width=80)'),
  );
  const source = 'myproject API reference';
  const summarise = {
    text: 'summarise',
    href: '/docs/api/myproject/#myproject.summarise',
    head: 'myproject.summarise(data: dict, *, top: int = 5) -> str',
    summary: 'Summarise a run as a short text report.',
    source,
  };
  const reportLink = {
    text: 'Report',
    href: '/docs/api/myproject/report/#myproject.report.Report',
    head: 'class myproject.report.Report(title: str)',
    summary: undefined,
    source,
  };
  expect(links(html)).toEqual([
    {
      text: 'myproject',
      href: '/docs/api/myproject/',
      head: 'module myproject',
      summary: 'Tools to summarise runs.',
      source,
    },
    summarise,
    reportLink,
    summarise,
    reportLink,
    {
      text: 'render',
      href: '/docs/api/myproject/report/#myproject.report.Report.render',
      head: 'Report.render(*, width: int | None = None) -> str',
      summary: undefined,
      source,
    },
  ]);
  expect(warnings).toEqual([]);
});

test('takes the first starlight-pydocs package that has a path, and wins over the inventories', async () => {
  pydocs({
    version: 1,
    packages: [
      { name: 'myproject', base: 'api/myproject', symbols: myproject() },
      {
        name: 'myproject',
        base: '1x/api/myproject',
        symbols: new Map([['myproject', { href: '/1x/api/myproject/', kind: 'module' }]]),
      },
      { name: 'json', base: 'api/json', symbols: new Map([['json', { href: '/api/json/', kind: 'module' }]]) },
    ],
  });
  const { html } = await render(block('py', 'import json, myproject'));
  expect(links(html).map((l) => [l.text, l.href])).toEqual([
    ['json', '/api/json/'],
    ['myproject', '/api/myproject/'],
  ]);
});

const versions = (): PydocsRegistry => ({
  version: 1,
  packages: [
    { name: 'myproject', base: 'api/myproject', symbols: myproject() },
    {
      name: 'myproject',
      base: '1x/api/myproject',
      symbols: new Map([
        ['myproject', { href: '/1x/api/myproject/', kind: 'module' }],
        ['myproject.Report', { href: '/1x/api/myproject/#myproject.Report', kind: 'class' }],
      ]),
    },
  ],
});

test('prefers the starlight-pydocs package at the pydocsBase of the block', async () => {
  pydocs(versions());
  const code = ['from myproject import Report'];
  const current = await render(block('py', ...code));
  expect(links(current.html).map((l) => l.href)).toEqual([
    '/api/myproject/',
    '/api/myproject/report/#myproject.report.Report',
  ]);
  const archived = await render(block('py pydocsBase="1x/api/myproject"', ...code));
  expect(links(archived.html).map((l) => l.href)).toEqual([
    '/1x/api/myproject/',
    '/1x/api/myproject/#myproject.Report',
  ]);
  expect(archived.warnings).toEqual([]);
});

test('falls back to the first package for a path that the pydocsBase package does not have', async () => {
  pydocs(versions());
  const { html } = await render(block('py pydocsBase="1x/api/myproject"', 'from myproject import summarise'));
  expect(links(html).map((l) => l.href)).toEqual(['/1x/api/myproject/', '/api/myproject/#myproject.summarise']);
});

test('warns once for a pydocsBase that no package has, and links as usual', async () => {
  pydocs(versions());
  const { html, warnings } = await render(
    block('py pydocsBase="2x/api/myproject"', 'import myproject', 'myproject.Report'),
  );
  expect(links(html).map((l) => l.href)).toEqual(['/api/myproject/', '/api/myproject/report/#myproject.report.Report']);
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toContain('pydocsBase="2x/api/myproject"');
});

test('reads the starlight-pydocs registry on each render, so that changes in dev show', async () => {
  const adapter = { apiLinks: { adapters: [python({ stdlib: false })] } };
  const code = block('py', 'from myproject import summarise');
  expect(links((await render(code, adapter)).html)).toEqual([]);
  const symbols = myproject();
  pydocs({ version: 1, packages: [{ name: 'myproject', base: 'api/myproject', symbols }] });
  expect(links((await render(code, adapter)).html).map((l) => l.text)).toEqual(['myproject', 'summarise']);
  symbols.delete('myproject.summarise');
  expect(links((await render(code, adapter)).html).map((l) => l.text)).toEqual(['myproject']);
});

test('ignores a starlight-pydocs registry of another version', async () => {
  pydocs({ version: 2, packages: [{ name: 'myproject', base: 'api/myproject', symbols: myproject() }] } as never);
  expect(await texts('import json, myproject')).toEqual(['json']);
});

test('reads more inventories, can leave out the standard library, and warns about bad ones', async () => {
  const header = '# Sphinx inventory version 2\n# Project: NumPy\n# Version: 2.3\n# The rest is compressed.\n';
  const body =
    'numpy py:module 1 reference/index.html#module-$ -\nnumpy.linspace py:function 1 reference/generated/numpy.linspace.html#$ -\n';
  const inventory = Buffer.concat([Buffer.from(header), deflateSync(body)]);
  const fetch = vi.fn(async (url: string) => {
    if (url === 'https://numpy.org/doc/stable/objects.inv') return new Response(inventory);
    if (url === 'https://example.com/page.inv') return new Response('<!doctype html>');
    throw new TypeError('fetch failed');
  });
  vi.stubGlobal('fetch', fetch);
  const { html, warnings } = await render(
    block('py', 'import json', 'import numpy as np', 'np.linspace(0, 1)'),
    withPython({
      stdlib: false,
      inventories: [
        'https://numpy.org/doc/stable/objects.inv',
        { url: 'https://example.com/page.inv', base: 'https://example.com/docs/' },
        'https://offline.example/objects.inv',
      ],
    }),
  );
  expect(links(html)).toEqual([
    {
      text: 'numpy',
      href: 'https://numpy.org/doc/stable/reference/index.html#module-numpy',
      head: 'module numpy',
      source: 'NumPy 2.3 documentation',
    },
    {
      text: 'np.linspace',
      href: 'https://numpy.org/doc/stable/reference/generated/numpy.linspace.html#numpy.linspace',
      head: 'function numpy.linspace',
      source: 'NumPy 2.3 documentation',
    },
  ]);
  expect(fetch).not.toHaveBeenCalledWith('https://docs.python.org/3/objects.inv', expect.anything());
  expect(warnings).toEqual([
    'API links, python adapter: https://example.com/page.inv is not a Sphinx objects.inv, version 2. Names from it stay plain text.',
    'API links, python adapter: could not fetch https://offline.example/objects.inv (fetch failed). Names from it stay plain text in this build.',
  ]);
});

test('readInventory keeps Python objects only, and fills in the short URI form', () => {
  const index = readInventory(
    readFileSync(new URL('./fixtures/python-stdlib.inv', import.meta.url)),
    'https://docs.python.org/3/',
  );
  expect(index.get('json.loads')).toEqual({
    name: 'json.loads',
    href: 'https://docs.python.org/3/library/json.html#json.loads',
    kind: 'function',
    source: 'Python 3.14 documentation',
  });
  expect([...index.keys()].some((name) => name.includes('acks'))).toBe(false);
});

test('the default options have python() and nextflow()', () => {
  const options = resolveOptions();
  expect(options.apiLinks ? options.apiLinks.adapters.map((a) => a.name) : []).toEqual(['python', 'nextflow']);
});
