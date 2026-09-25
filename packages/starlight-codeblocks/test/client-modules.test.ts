import { gzipSync } from 'node:zlib';
import { afterEach, expect, test } from 'vitest';
import { clientJsModules, loaderSource, readClientModules } from '../src/client-modules.ts';
import { clientModulePlugins } from '../src/integration.ts';
import { setRegistry } from '../src/registry.ts';

afterEach(() => setRegistry(undefined));

const modules = [{ feature: 'annotations', fileName: 'scb-annotations.abc.js', source: 'export default () => {}' }];

test('the asset loader imports files next to itself', () => {
  const source = loaderSource(modules, false);
  expect(source).toContain('{"annotations":"scb-annotations.abc.js"}');
  expect(source).toContain('import.meta.url');
  expect(source).toContain("document.addEventListener('astro:page-load', load)");
});

test('the inline loader carries the sources, safe for a script element', () => {
  const source = loaderSource([{ ...modules[0], source: 'const s = "</script>";' } as never], true);
  expect(source).toContain('\\u003c/script>');
  expect(source).not.toContain('</script>');
  expect(source).toContain('URL.createObjectURL');
});

test('features use the inline loader unless codeblocks() emits the modules', () => {
  expect(clientJsModules()[0]).toContain('createObjectURL');
  setRegistry({ options: {} as never, plugins: [], clientAssets: true });
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

// Token transitions and runtimes are outside the budget (SPEC section 2).
test.each(readClientModules().filter((m) => !['transitions', 'runnable'].includes(m.feature)))(
  '$feature is 3 kB or less, minified and gzipped',
  ({ source }) => {
    expect(gzipSync(source).length).toBeLessThanOrEqual(3072);
  },
);
