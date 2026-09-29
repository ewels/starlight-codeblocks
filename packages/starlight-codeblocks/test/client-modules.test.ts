import { realpathSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { afterEach, expect, test } from 'vitest';
import { clientJsModules, loaderSource, packageRoot, readClientModules } from '../src/client-modules.ts';
import { clientModulePlugins } from '../src/integration.ts';
import { setRegistry } from '../src/registry.ts';

afterEach(() => setRegistry(undefined));

const modules = [{ feature: 'annotations', fileName: 'scb-annotations.abc.js', source: 'export default () => {}' }];

test('finds the package from a site bundle, as with plugins in ec.config.mjs', () => {
  const chunk = new URL('../../../docs/dist/.prerender/chunks/ec.config_abc.mjs', import.meta.url);
  expect(realpathSync(packageRoot(chunk.href))).toBe(realpathSync(new URL('..', import.meta.url)));
});

test('the asset loader imports files next to itself, and the inline loader carries the sources safely', () => {
  const asset = loaderSource(modules, false);
  expect(asset).toContain('{"annotations":"scb-annotations.abc.js"}');
  expect(asset).toContain('import.meta.url');
  expect(asset).toContain("document.addEventListener('astro:page-load', load)");
  const inline = loaderSource([{ ...modules[0], source: 'const s = "</script>";' } as never], true);
  expect(inline).toContain('\\u003c/script>');
  expect(inline).not.toContain('</script>');
  expect(inline).toContain('URL.createObjectURL');
});

test('features use the inline loader unless codeblocks() emits the modules', () => {
  expect(clientJsModules()[0]).toContain('createObjectURL');
  setRegistry({ options: {} as never, plugins: [] });
  expect(clientJsModules()[0]).not.toContain('createObjectURL');
});

test('the Vite plugins serve the modules in dev and emit them in the build', () => {
  const [serve, build] = clientModulePlugins('_astro');
  for (const m of readClientModules()) {
    const id = serve?.resolveId?.(`/_astro/${m.fileName}?import`);
    expect(serve?.load?.(id as string)).toBe(m.source);
  }
  expect(serve?.resolveId?.('/_astro/other.js')).toBeUndefined();
  const emitted: string[] = [];
  build?.buildEnd?.call({ emitFile: (file) => emitted.push(file.fileName) });
  expect(emitted).toEqual(readClientModules().map((m) => `_astro/${m.fileName}`));
});

// Code walkthrough (its animation library) and runtimes are outside the budget.
test('each client module is 3 kB or less, minified and gzipped', () => {
  const budgeted = readClientModules().filter((m) => !['walkthrough', 'runnable'].includes(m.feature));
  expect(budgeted.length).toBeGreaterThan(5);
  const over = budgeted.map((m) => [m.feature, gzipSync(m.source).length] as const).filter(([, size]) => size > 3072);
  expect(over).toEqual([]);
});
