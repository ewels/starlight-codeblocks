import { readdirSync } from 'node:fs';
import { defineConfig, type UserConfig } from 'tsdown';

// One build per feature module, so that each file stands alone for the loader and the 3 kB budget.
const clientModules = readdirSync('src/client').filter((f) => f.endsWith('.ts'));

export default defineConfig([
  {
    entry: ['src/index.ts', 'src/expressive-code/index.ts', 'src/adapters/python.ts', 'src/adapters/nextflow.ts'],
    format: 'esm',
    dts: true,
  },
  {
    entry: {
      'runtimes/pyodide': 'src/runtimes/pyodide.ts',
      'runtimes/javascript': 'src/runtimes/javascript.ts',
      'runtimes/typescript': 'src/runtimes/typescript.ts',
    },
    platform: 'browser',
    format: 'esm',
    fixedExtension: true,
    minify: true,
    dts: true,
    // Sites without codeblocks() import runtimes from a CDN, so each one carries its dependencies, such as Sucrase.
    deps: { alwaysBundle: [/.*/] },
    clean: false,
  },
  ...clientModules.map(
    (file): UserConfig => ({
      entry: { [`scb-${file.slice(0, -3)}`]: `src/client/${file}` },
      outDir: 'dist/client',
      platform: 'browser',
      format: 'esm',
      minify: true,
      dts: false,
      // Browser files load on their own, so they carry their dependencies, such as lz-string.
      deps: { alwaysBundle: [/.*/] },
      clean: false,
      outputOptions: { entryFileNames: '[name].[hash].js' },
    }),
  ),
]);
