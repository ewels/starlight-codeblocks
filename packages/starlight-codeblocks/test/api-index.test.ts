import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';
import { type ApiIndex, type ApiIndexAdapterOptions, apiIndex } from '../src/adapters/api-index.ts';
import { block, apiLinks as links, render } from './render.ts';

/** A small index of a made-up library, Tally, linked in Ruby blocks, which have no adapter of their own. */
const tally: ApiIndex = {
  apiIndex: 1,
  source: 'Tally reference',
  base: 'https://tally.example/docs/',
  symbols: [
    { name: 'open', kind: 'function', href: 'io#open', signature: 'open(path: String) -> File', type: 'File' },
    { name: 'log', kind: 'namespace', href: 'log' },
    { name: 'log.info', kind: 'function', href: 'log#info', summary: 'Logs a message.' },
    { name: 'File', kind: 'type', href: 'file', extends: ['Stream'] },
    { name: 'File.lines', kind: 'property', href: 'file#lines', type: 'List<String>' },
    { name: 'Stream', kind: 'type', href: 'stream' },
    { name: 'Stream.close', kind: 'function', href: 'stream#close' },
    { name: 'List', kind: 'type', href: 'list' },
    { name: 'List.size', kind: 'function', href: 'list#size', type: 'Integer' },
    { name: 'String', kind: 'type', href: 'string' },
    { name: 'String.trim', kind: 'function', href: 'string#trim', type: 'String' },
    { name: 'retries', kind: 'setting', context: 'config', href: 'config#retries' },
  ],
};

const withIndex = (options: Partial<ApiIndexAdapterOptions> = {}) => ({
  apiLinks: { adapters: [apiIndex({ languages: ['ruby'], index: tally, ...options })] },
});
const texts = async (lines: string[], options?: Partial<ApiIndexAdapterOptions>, language = 'ruby') =>
  links((await render(block(language, ...lines), withIndex(options))).html).map((l) => l.text);

test('links global names, each part of a dotted name, and the card from the index', async () => {
  const { html, warnings } = await render(block('ruby', "f = open('a.txt')", "log.info('done')"), withIndex());
  expect(links(html)).toEqual([
    {
      text: 'open',
      href: 'https://tally.example/docs/io#open',
      head: 'open(path: String) -> File',
      source: 'Tally reference',
    },
    { text: 'log', href: 'https://tally.example/docs/log', head: 'namespace log', source: 'Tally reference' },
    {
      text: 'info',
      href: 'https://tally.example/docs/log#info',
      head: 'function log.info',
      summary: 'Logs a message.',
      source: 'Tally reference',
    },
  ]);
  expect(warnings).toEqual([]);
});

test('follows the type of each value through its members, also from the types it extends', async () => {
  const cases: [string[], string[]][] = [
    [["open('a').lines.size()"], ['open', 'lines', 'size']],
    [
      ["f = open('a')", 'f.close()', 'f.lines'],
      ['open', 'close', 'lines'],
    ],
    [
      ['f: File', 'f.lines.size()'],
      ['File', 'lines', 'size'],
    ],
    [["' padded '.trim()"], ['trim']],
    [["f = open('a')", 'f = 2', 'f.lines'], ['open']],
    [["f = open('a')", 'f.unknown.size()'], ['open']],
  ];
  for (const [lines, expected] of cases) expect(await texts(lines), lines.join('\n')).toEqual(expected);
});

test('leaves names with a context, names in comments and strings, and members of other values plain', async () => {
  const lines = ['retries = 3', '// open(x)', '# open(x)', "x = 'open(y)'", 'other.open()', 'map = { open: 1 }'];
  expect(await texts(lines)).toEqual([]);
  expect(await texts(['-- open(x)', '# open(x)'], { languages: ['lua'], syntax: { comments: ['--'] } }, 'lua')).toEqual(
    ['open'],
  );
});

test('reads the index from a file, from a URL that the build keeps, or warns', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'scb-api-index-'));
  const file = join(dir, 'tally.json');
  writeFileSync(file, JSON.stringify(tally));
  expect(await texts(['open(x)'], { index: file })).toEqual(['open']);

  const fetch = vi.fn(async (url: string) => {
    if (url === 'https://tally.example/api-index.json') return new Response(JSON.stringify(tally));
    if (url === 'https://tally.example/old.json') return new Response('{"version": 1}');
    throw new TypeError('fetch failed');
  });
  vi.stubGlobal('fetch', fetch);
  expect(await texts(['open(x)'], { index: 'https://tally.example/api-index.json' })).toEqual(['open']);

  for (const [index, warning] of [
    ['https://tally.example/old.json', 'https://tally.example/old.json is not an API index, version 1. Names from'],
    [join(dir, 'missing.json'), `could not read ${join(dir, 'missing.json')}`],
  ]) {
    const { html, warnings } = await render(block('ruby', 'open(x)'), withIndex({ index, name: 'tally' }));
    expect(links(html)).toEqual([]);
    expect(warnings).toEqual([expect.stringContaining(`API links, tally adapter: ${warning}`)]);
  }
});
