import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRegistry } from './registry.ts';

export interface ClientModule {
  /** The feature name. The loader imports the module on pages with a `data-scb-<feature>` element. */
  feature: string;
  fileName: string;
  source: string;
}

const FILE = /^scb-(.+)\.[\w-]+\.js$/;

function packageRoot() {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(join(dir, 'package.json'))) dir = dirname(dir);
  return dir;
}

let cache: ClientModule[] | undefined;

/** The prebuilt feature modules in `dist/client/`. */
export function readClientModules(): ClientModule[] {
  if (cache) return cache;
  const dir = join(packageRoot(), 'dist', 'client');
  cache = existsSync(dir)
    ? readdirSync(dir).flatMap((fileName) => {
        const feature = fileName.match(FILE)?.[1];
        return feature ? [{ feature, fileName, source: readFileSync(join(dir, fileName), 'utf8') }] : [];
      })
    : [];
  return cache;
}

/**
 * The loader for `jsModules`. It imports each feature module on pages that use the feature.
 * With `inline`, the module sources are part of the loader, for sites without `codeblocks()`.
 */
export function loaderSource(modules: ClientModule[], inline: boolean): string {
  const map = Object.fromEntries(modules.map((m) => [m.feature, inline ? m.source : m.fileName]));
  const url = inline
    ? `const urls = {};
  const url = (name) => (urls[name] ??= URL.createObjectURL(new Blob([modules[name]], { type: 'text/javascript' })));`
    : // A variable, so that Vite does not rewrite `new URL(…, import.meta.url)` in dev.
      `const here = import.meta.url;
  const url = (name) => new URL('./' + modules[name], here).href;`;
  return `{
  const modules = ${JSON.stringify(map).replaceAll('<', '\\u003c')};
  ${url}
  const load = () => {
    for (const name in modules) {
      if (document.querySelector('[data-scb-' + name + ']')) import(/* @vite-ignore */ url(name)).then((m) => m.default?.());
    }
  };
  load();
  document.addEventListener('astro:page-load', load);
}`;
}

/** The `jsModules` of every feature with a client module. Expressive Code removes the duplicates. */
export const clientJsModules = () => [loaderSource(readClientModules(), !getRegistry()?.clientAssets)];
