import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getColorContrast } from '@expressive-code/core';
import { afterEach, expect, test, vi } from 'vitest';
import { cachedFetch } from '../src/expressive-code/api-links.ts';
import type { ApiLinkAdapter, Resolution, SymbolRef } from '../src/options.ts';
import { resolveOptions } from '../src/options.ts';
import { setRegistry } from '../src/registry.ts';
import { variants } from './contrast.ts';
import { block, render } from './render.ts';

const resolutions: Record<string, Resolution> = {
  'lib.parse': {
    href: 'https://example.com/lib#parse',
    kind: 'function',
    signature: 'lib.parse(text, *, strict=False)',
    summary: 'Parse the text.',
    source: 'Example docs',
  },
  lib: { href: '/reference/lib/', kind: 'module', source: 'Example docs' },
  evil: { href: 'javascript:alert(1)', source: 'Bad inventory' },
};

/** Links `lib` and `lib.parse` outside strings, like a real adapter would. */
function fakeAdapter(overrides: Partial<ApiLinkAdapter> = {}): ApiLinkAdapter {
  return {
    name: 'fake',
    languages: ['js'],
    setup: vi.fn(async () => {}),
    findSymbols(code) {
      const symbols: SymbolRef[] = [];
      for (const match of code.matchAll(/"[^"]*"|\b(lib\.parse|lib|evil)\b/g)) {
        const known = match[1] && resolutions[match[1]];
        if (known) symbols.push({ name: match[0], ...known, start: match.index, end: match.index + match[0].length });
      }
      return symbols;
    },
    ...overrides,
  };
}

const withAdapters = (...adapters: ApiLinkAdapter[]) => ({ apiLinks: { adapters } });

afterEach(() => setRegistry(undefined));

test('links resolved names, with the card text on the link', async () => {
  const { html, copyText, warnings } = await render(
    block('js', 'const tree = lib.parse(text);'),
    withAdapters(fakeAdapter()),
  );
  expect(html).toContain(
    '<a class="scb-api-link" href="https://example.com/lib#parse" aria-description="lib.parse(text, *, strict=False). Parse the text. Example docs." data-scb-api-head="lib.parse(text, *, strict=False)" data-scb-api-source="Example docs" data-scb-api-summary="Parse the text.">',
  );
  // One link for the whole name, although the name has three tokens.
  expect(html.match(/class="scb-api-link"/g)).toHaveLength(1);
  expect(html).toMatch(/<figure[^>]*data-scb-api-links/);
  expect(copyText).toBe('const tree = lib.parse(text);');
  expect(warnings).toEqual([]);
});

test('keeps the syntax colours of the linked name', async () => {
  const { html } = await render(block('js', 'lib.parse(text)'), withAdapters(fakeAdapter()));
  expect(html).toMatch(/<a class="scb-api-link"[^>]*><span style="--0:[^"]*">lib\.<\/span>/);
});

test('shows the kind and name when there is no signature, and adds Astro base', async () => {
  setRegistry({ options: resolveOptions(), plugins: [], base: '/docs' });
  const { html } = await render(block('js', 'lib'), withAdapters(fakeAdapter()));
  expect(html).toContain('href="/docs/reference/lib/"');
  expect(html).toContain('data-scb-api-head="module lib"');
  expect(html).not.toContain('data-scb-api-summary');
});

test('uses the qualified name from the resolution', async () => {
  const adapter = fakeAdapter({
    findSymbols: () => [{ start: 0, end: 3, href: '/x/', kind: 'class', name: 'pkg.lib', source: 'S' }],
  });
  const { html } = await render(block('js', 'lib'), withAdapters(adapter));
  expect(html).toContain('data-scb-api-head="class pkg.lib"');
});

test('leaves names that do not resolve, names in strings and unsafe links as plain text', async () => {
  const { html } = await render(block('js', 'other("lib"); evil();'), withAdapters(fakeAdapter()));
  expect(html).not.toContain('scb-api-link');
  expect(html).not.toContain('data-scb-api-links');
});

test('skips names that cross a line, and names that overlap a linked name', async () => {
  const overlap = fakeAdapter({
    findSymbols: () => [
      { start: 0, end: 9, name: 'lib.parse', href: '/x/', source: 'S' },
      { start: 4, end: 9, name: 'lib.parse', href: '/x/', source: 'S' },
      { start: 0, end: 3, name: 'lib', href: '/x/', source: 'S' },
      { start: 12, end: 17, name: 'lib', href: '/x/', source: 'S' },
    ],
  });
  const { html } = await render(block('js', 'lib.parse()', 'lib', 'x'), withAdapters(overlap));
  expect(html.match(/class="scb-api-link"/g)).toHaveLength(1);
});

test('only runs adapters for their languages and aliases, and not with apiLinks=false', async () => {
  const adapter = fakeAdapter();
  expect((await render(block('py', 'lib'), withAdapters(adapter))).html).not.toContain('scb-api-link');
  expect((await render(block('js apiLinks=false', 'lib'), withAdapters(adapter))).html).not.toContain('scb-api-link');
  expect(adapter.setup).not.toHaveBeenCalled();
  expect((await render(block('javascript', 'lib'), withAdapters(adapter))).html).toContain('scb-api-link');
});

test('runs setup once for every block, and gives it the context', async () => {
  const adapter = fakeAdapter();
  setRegistry({ options: resolveOptions(), plugins: [], root: '/site', cacheDir: '/site/.cache' });
  await render(block('js', 'lib'), withAdapters(adapter));
  await render(block('js', 'lib.parse()'), withAdapters(adapter));
  expect(adapter.setup).toHaveBeenCalledTimes(1);
  const [context] = vi.mocked(adapter.setup).mock.calls[0] ?? [];
  expect(context).toMatchObject({ root: '/site', cacheDir: '/site/.cache' });
  expect(context?.fetch).toBeTypeOf('function');
});

test('an adapter that fails in setup links nothing, with a warning', async () => {
  const adapter = fakeAdapter({ setup: async () => Promise.reject(new Error('no index')) });
  const { html, warnings } = await render(block('js', 'lib'), withAdapters(adapter));
  expect(html).not.toContain('scb-api-link');
  expect(warnings).toEqual(['API links, fake adapter: setup failed, so it links nothing: no index']);
});

test('an adapter whose setup throws before it returns links nothing, with a warning', async () => {
  const adapter = fakeAdapter({
    setup: () => {
      throw new Error('no index');
    },
  });
  const { html, warnings } = await render(block('js', 'lib'), withAdapters(adapter));
  expect(html).not.toContain('scb-api-link');
  expect(warnings).toEqual(['API links, fake adapter: setup failed, so it links nothing: no index']);
});

test('does not link names on a line with a token link', async () => {
  const { html } = await render(
    block('js', '// [!link /lib/ https://example.com/]', 'lib.parse()', 'lib'),
    withAdapters(fakeAdapter()),
  );
  expect(html.match(/class="scb-link"/g)).toHaveLength(1);
  expect(html.match(/class="scb-api-link"/g)).toHaveLength(1);
});

test('renders a block the same without the feature when nothing links', async () => {
  const md = block('js title="a.js"', 'const a = 1;');
  expect((await render(md, withAdapters(fakeAdapter()))).html).toBe((await render(md, { apiLinks: false })).html);
});

test('the underline meets 3:1 contrast, and the card source 4.5:1, in both themes', async () => {
  for (const { get, name } of await variants()) {
    const bg = get('codeBackground');
    expect(getColorContrast(get('codeblocksApiLinks.underline'), bg), name).toBeGreaterThanOrEqual(3);
    expect(getColorContrast(get('codeblocksApiLinks.hoverUnderline'), bg), name).toBeGreaterThanOrEqual(3);
    expect(
      getColorContrast(get('codeblocks.mutedForeground'), get('codeblocks.popoverBackground')),
      name,
    ).toBeGreaterThanOrEqual(4.5);
  }
});

test('cachedFetch keeps the body on disk, so a later build does not fetch again', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'scb-cache-'));
  const fetch = vi.fn(async () => new Response('inventory'));
  vi.stubGlobal('fetch', fetch);
  try {
    const warn = vi.fn();
    const first = await cachedFetch('https://example.com/objects.inv', dir, warn);
    const second = await cachedFetch('https://example.com/objects.inv', dir, warn);
    expect(new TextDecoder().decode(first ?? undefined)).toBe('inventory');
    expect(second).toEqual(first);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(readdirSync(dir)).toHaveLength(1);
    expect(warn).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
    rmSync(dir, { recursive: true });
  }
});

test('cachedFetch keeps no body that fails the check, and fetches again for a kept one that fails it', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'scb-cache-'));
  let reply = '<!doctype html>';
  const fetch = vi.fn(async () => new Response(reply));
  vi.stubGlobal('fetch', fetch);
  const check = (body: Uint8Array) => {
    if (new TextDecoder().decode(body) !== 'inventory') throw new Error('not an inventory');
  };
  try {
    const warn = vi.fn();
    expect(await cachedFetch('https://example.com/objects.inv', dir, warn, check)).toBeNull();
    expect(warn.mock.calls).toEqual([
      ['https://example.com/objects.inv is not an inventory. Names from it stay plain text.'],
    ]);
    expect(readdirSync(dir)).toEqual([]);
    reply = 'stale';
    await cachedFetch('https://example.com/objects.inv', dir, warn);
    reply = 'inventory';
    const body = await cachedFetch('https://example.com/objects.inv', dir, warn, check);
    expect(new TextDecoder().decode(body ?? undefined)).toBe('inventory');
    expect(fetch).toHaveBeenCalledTimes(3);
  } finally {
    vi.unstubAllGlobals();
    rmSync(dir, { recursive: true });
  }
});

test('cachedFetch returns null with a warning when the request fails, and caches nothing', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'scb-cache-'));
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.includes('offline')) throw new TypeError('fetch failed');
      return new Response('Not found', { status: 404 });
    }),
  );
  try {
    const warn = vi.fn();
    expect(await cachedFetch('https://example.com/missing.inv', dir, warn)).toBeNull();
    expect(await cachedFetch('https://offline.example/objects.inv', dir, warn)).toBeNull();
    expect(warn.mock.calls.map(([message]) => message)).toEqual([
      'could not fetch https://example.com/missing.inv (HTTP 404). Names from it stay plain text in this build.',
      'could not fetch https://offline.example/objects.inv (fetch failed). Names from it stay plain text in this build.',
    ]);
    expect(readdirSync(dir)).toEqual([]);
  } finally {
    vi.unstubAllGlobals();
    rmSync(dir, { recursive: true });
  }
});
