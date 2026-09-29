import { readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { afterEach, expect, test, vi } from 'vitest';
import { type PydocsRegistry, type PydocsSymbol, python } from '../src/adapters/python.ts';
import { readInventory } from '../src/adapters/python-index.ts';
import { type CodeblocksOptions, resolveOptions } from '../src/options.ts';
import { setRegistry } from '../src/registry.ts';
import { block, apiLinks as links, render } from './render.ts';

const texts = async (...lines: string[]) => links((await render(block('py', ...lines))).html).map((l) => l.text);
const hrefs = async (fence: string, ...lines: string[]) =>
  links((await render(block(fence, ...lines))).html).map((l) => l.href);

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
  const path = { text: 'Path', href: `${docs}/pathlib.html#pathlib.Path`, head: 'class pathlib.Path', source };
  expect(links(html)).toEqual([
    { text: 'json', href: `${docs}/json.html#module-json`, head: 'module json', source },
    { text: 'pathlib', href: `${docs}/pathlib.html#module-pathlib`, head: 'module pathlib', source },
    path,
    { text: 'json.loads', href: `${docs}/json.html#json.loads`, head: 'function json.loads', source },
    path,
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

const cases: [string[], string[]][] = [
  // Aliases and dotted imports.
  [
    ['import json as j', 'j.loads(s)'],
    ['json', 'j.loads'],
  ],
  [
    ['from json import loads as parse', 'parse(s)'],
    ['json', 'loads', 'parse'],
  ],
  [
    ['import os.path', 'os.path.join(a, b)'],
    ['os.path', 'os.path.join'],
  ],
  [
    ['import os', 'os.path.join(a, b)'],
    ['os', 'os.path.join'],
  ],
  [
    ['from os import (', '    path,', ')', 'path.join(a)'],
    ['os', 'path', 'path.join'],
  ],
  // The longest known part of a chain; a type only after a call to a class.
  [
    ['import json', 'json.missing.loads(s)'],
    ['json', 'json'],
  ],
  [
    ['import json', 'json.loads(s).read_text()'],
    ['json', 'json.loads'],
  ],
  [
    ['from pathlib import Path', 'Path.missing().read_text()'],
    ['pathlib', 'Path', 'Path'],
  ],
  // Strings and comments.
  [['import json', '"json.loads"', "f'{json.loads(s)}'", '# json.loads(s)', '"""', 'json.loads(s)', '"""'], ['json']],
  [['import json', "b'json' + r'\\'json.loads'"], ['json']],
  [
    ['x = "open', 'import json', 'json.loads(s)'],
    ['json', 'json.loads'],
  ],
  // Names not imported, or bound again.
  [['loads(s)', 'self.json.loads(s)'], []],
  [['import json', 'json = {}', 'json.loads(s)'], ['json']],
  [
    ['from pathlib import Path', 'def read(Path):', '    Path.read_text()'],
    ['pathlib', 'Path'],
  ],
  [['import json', 'for json in items:', '    json.loads(s)'], ['json']],
  [['import json', 'with open(p) as json:', '    json.loads(s)'], ['json']],
  [['import json', 'async def f(json):', '    json.dumps(1)'], ['json']],
  [['import json', 'f = lambda k, json: json.dumps(k)'], ['json']],
  [['import json', 'f = lambda *json: json.dumps(1)'], ['json']],
  [['import json', 'json: dict = {}', 'json.loads(s)'], ['json']],
  [['import json', 'if ok: json = {}', 'json.loads(s)'], ['json']],
  // Comparisons, keyword arguments, annotations and defaults are not bindings.
  [
    ['import json', 'json == other', 'json.loads(s)'],
    ['json', 'json', 'json.loads'],
  ],
  [
    ['import json', 'post(url, json=json.dumps(x))'],
    ['json', 'json.dumps'],
  ],
  [
    ['from pathlib import Path', 'p: Path = Path("x")'],
    ['pathlib', 'Path', 'Path', 'Path'],
  ],
  [
    ['from pathlib import Path', 'def f(p: Path = Path("x")):', '    pass'],
    ['pathlib', 'Path', 'Path', 'Path'],
  ],
  [
    ['from pathlib import Path', 'def read(p: dict[str, Path]) -> Path:', '    return Path(p)'],
    ['pathlib', 'Path', 'Path', 'Path', 'Path'],
  ],
  [
    ['import json', 'def f(a, b=g(1, json)):', '    json.loads(a)'],
    ['json', 'json', 'json.loads'],
  ],
  [
    ['import json', 'f = lambda k: json.dumps(k)'],
    ['json', 'json.dumps'],
  ],
  [
    ['import json', 'def main(): print(json, 1)', 'json.loads(s)'],
    ['json', 'json', 'json.loads'],
  ],
];

test('follows imports, aliases and bindings, and skips strings and comments', async () => {
  for (const [lines, expected] of cases) expect(await texts(...lines), lines.join('\n')).toEqual(expected);
});

test.each<CodeblocksOptions>([{}, { shellCopy: false }])(
  'links a pycon session and skips its output, with %o',
  async (options) => {
    const { html } = await render(block('pycon', '>>> import json', '>>> json.dumps(1)', 'json.loads(s)'), options);
    expect(links(html).map((l) => l.text)).toEqual(['json', 'json.dumps']);
  },
);

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
    // A documented re-export of a class from a private module.
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
  setRegistry({ options: resolveOptions(), plugins: [], base: '/docs' });
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

test('takes the first starlight-pydocs package that has a path, wins over the inventories, and ignores other versions', async () => {
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
  expect(await hrefs('py', 'import json, myproject')).toEqual(['/api/json/', '/api/myproject/']);
  pydocs({ version: 2, packages: [{ name: 'myproject', base: 'api/myproject', symbols: myproject() }] } as never);
  expect(await texts('import json, myproject')).toEqual(['json']);
});

test('prefers the starlight-pydocs package at the pydocsBase of the block, falls back to the first, and warns for an unknown one', async () => {
  pydocs({
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
  const code = ['from myproject import Report, summarise'];
  expect(await hrefs('py', ...code)).toEqual([
    '/api/myproject/',
    '/api/myproject/report/#myproject.report.Report',
    '/api/myproject/#myproject.summarise',
  ]);
  const archived = await render(block('py pydocsBase="1x/api/myproject"', ...code));
  expect(links(archived.html).map((l) => l.href)).toEqual([
    '/1x/api/myproject/',
    '/1x/api/myproject/#myproject.Report',
    '/api/myproject/#myproject.summarise',
  ]);
  expect(archived.warnings).toEqual([]);
  const unknown = await render(block('py pydocsBase="2x/api/myproject"', 'import myproject', 'myproject.Report'));
  expect(links(unknown.html).map((l) => l.href)).toEqual([
    '/api/myproject/',
    '/api/myproject/report/#myproject.report.Report',
  ]);
  expect(unknown.warnings).toEqual([expect.stringContaining('pydocsBase="2x/api/myproject"')]);
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
  const adapter = python({
    stdlib: false,
    inventories: [
      'https://numpy.org/doc/stable/objects.inv',
      { url: 'https://example.com/page.inv', base: 'https://example.com/docs/' },
      'https://offline.example/objects.inv',
    ],
  });
  const { html, warnings } = await render(block('py', 'import json', 'import numpy as np', 'np.linspace(0, 1)'), {
    apiLinks: { adapters: [adapter] },
  });
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

test('fills in a summary from the documentation page, once per page, and quietly leaves it out when the page fails', async () => {
  const header = '# Sphinx inventory version 2\n# Project: Tally\n# Version: 1.0\n# The rest is compressed.\n';
  const body = [
    'tally py:module 1 api.html#module-$ -',
    'tally.count py:function 1 api.html#$ -',
    'tally.total py:function 1 api.html#$ -',
    'tally.gone py:function 1 missing.html#$ -',
  ].join('\n');
  const inventory = Buffer.concat([Buffer.from(header), deflateSync(`${body}\n`)]);
  const page = `<!doctype html><section id="module-tally"><h1><code>tally</code> — Count things fast¶</h1>
<dl><dt id="tally.count">tally.count(items)</dt><dt id="tally.total">tally.total(items)</dt>
<dd><p>Counts the <code>items</code> (any iterable) in one pass over them. Slow for generators.</p></dd></dl></section>`;
  const fetch = vi.fn(async (url: string) => {
    if (url === 'https://tally.example/objects.inv') return new Response(inventory);
    if (url === 'https://tally.example/api.html') return new Response(page);
    throw new TypeError('fetch failed');
  });
  vi.stubGlobal('fetch', fetch);
  const code = block('py', 'import tally', 'tally.count(x)', 'tally.total(x)', 'tally.gone(x)');
  const run = (summaries?: boolean) =>
    render(code, {
      apiLinks: {
        adapters: [python({ stdlib: false, inventories: ['https://tally.example/objects.inv'], summaries })],
      },
    });
  const { html, warnings } = await run();
  const summaries = [...html.matchAll(/data-scb-api-summary="([^"]*)"/g)].map((m) => m[1]);
  expect(summaries).toEqual([
    'Count things fast',
    'Counts the items in one pass over them.',
    'Counts the items in one pass over them.',
  ]);
  expect(html).toContain(
    'aria-description="function tally.count. Counts the items in one pass over them. Tally 1.0 documentation."',
  );
  expect(warnings).toEqual([]);
  expect(fetch.mock.calls.filter(([url]) => url === 'https://tally.example/api.html')).toHaveLength(1);
  expect((await run(false)).html).not.toContain('data-scb-api-summary');
});
