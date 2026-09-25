import type { ExpressiveCodePlugin } from '@expressive-code/core';
import type { ResolvedOptions } from './options.ts';

export interface Registry {
  options: ResolvedOptions;
  /** The real plugin objects, for `<Code>` through the `ec-config` override. */
  plugins: ExpressiveCodePlugin[];
  /** True when `codeblocks()` emits the client modules as assets. The loader imports them inline otherwise. */
  clientAssets: boolean;
}

// A global, because Astro loads the config and renders pages through different module instances.
const KEY = Symbol.for('starlight-codeblocks');
const store = globalThis as { [KEY]?: Registry };

export const getRegistry = () => store[KEY];

export function setRegistry(registry: Registry | undefined) {
  store[KEY] = registry;
}
