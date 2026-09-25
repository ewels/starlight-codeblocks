import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { afterEach, expect, test, vi } from 'vitest';
import { type PythonAdapterOptions, python } from '../src/adapters/python.ts';
import { firstSentence, readInventory } from '../src/adapters/python-index.ts';
import { resolveOptions } from '../src/options.ts';
import { setRegistry } from '../src/registry.ts';
import { render } from './render.ts';

const block = (fence: string, ...lines: string[]) => [`\`\`\`${fence}`, ...lines, '```'].join('\n');
const dump = new URL('./fixtures/myproject-dump.json', import.meta.url).pathname;
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

test('links the objects of a starlight-pydocs package, with signatures and summaries', async () => {
  setRegistry({ options: resolveOptions(), plugins: [], clientAssets: true, base: '/docs' });
  const { html, warnings } = await render(
    block('py', 'from myproject import summarise, Report', 'print(summarise(data))', 'Report("Run").render(width=80)'),
    withPython({ pydocs: [{ package: 'myproject', dump }] }),
  );
  const source = 'myproject API reference';
  const report = {
    href: '/docs/api/myproject/report/#myproject.report.Report',
    head: 'class myproject.report.Report(title: str)',
    summary: 'A run report.',
    source,
  };
  const summarise = {
    text: 'summarise',
    href: '/docs/api/myproject/#myproject.summarise',
    head: 'myproject.summarise(data: dict, *, top: int = 5) -> str',
    summary: 'Summarise a run as a short text report.',
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
    { text: 'Report', ...report },
    summarise,
    { text: 'Report', ...report },
    {
      text: 'render',
      href: '/docs/api/myproject/report/#myproject.report.Report.render',
      head: 'Report.render(*, width: int | None = None) -> str',
      summary: 'Render the report as text.',
      source,
    },
  ]);
  expect(warnings).toEqual([]);
});

test('finds the dump that starlight-pydocs keeps in the cache folder, and uses its base', async () => {
  const cacheDir = mkdtempSync(join(tmpdir(), 'scb-astro-'));
  mkdirSync(join(cacheDir, 'starlight-pydocs', 'myproject-1bc6de33edf5'), { recursive: true });
  cpSync(dump, join(cacheDir, 'starlight-pydocs', 'myproject-1bc6de33edf5', 'dump.json'));
  setRegistry({ options: resolveOptions(), plugins: [], clientAssets: true, cacheDir });
  try {
    const { html } = await render(
      block('py', 'from myproject import summarise'),
      withPython({ pydocs: [{ package: 'myproject', base: '/reference/myproject/' }] }),
    );
    expect(links(html).map((l) => l.href)).toEqual([
      '/reference/myproject/',
      '/reference/myproject/#myproject.summarise',
    ]);
  } finally {
    rmSync(cacheDir, { recursive: true });
  }
});

test('warns when a starlight-pydocs package has no data, and still links the standard library', async () => {
  const cacheDir = mkdtempSync(join(tmpdir(), 'scb-astro-'));
  setRegistry({ options: resolveOptions(), plugins: [], clientAssets: true, cacheDir });
  try {
    const { html, warnings } = await render(
      block('py', 'import json', 'from myproject import summarise'),
      withPython({ pydocs: [{ package: 'myproject' }] }),
    );
    expect(links(html).map((l) => l.text)).toEqual(['json']);
    expect(warnings).toEqual([
      `API links, python adapter: found no starlight-pydocs data for \`myproject\` in ${join(cacheDir, 'starlight-pydocs')}. Add starlight-pydocs to the site, or give the dump path in \`dump\`.`,
    ]);
  } finally {
    rmSync(cacheDir, { recursive: true });
  }
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

test('firstSentence takes the first sentence of the first paragraph', () => {
  expect(firstSentence('Say hello.\n\nMore text.')).toBe('Say hello.');
  expect(firstSentence('Parse the\ntext. Then more.')).toBe('Parse the text.');
  expect(firstSentence('No full stop')).toBe('No full stop');
  expect(firstSentence('Use v1.2 here. Next.')).toBe('Use v1.2 here.');
});

test('the default options link the standard library with python()', () => {
  const options = resolveOptions();
  expect(options.apiLinks ? options.apiLinks.adapters.map((a) => a.name) : []).toEqual(['python']);
});
