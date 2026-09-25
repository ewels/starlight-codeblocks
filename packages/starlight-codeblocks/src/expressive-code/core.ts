import { definePlugin } from '@expressive-code/core';

/** Shared parts that every feature needs. The preset adds it first. */
export function pluginCore() {
  return definePlugin({ name: 'starlight-codeblocks:core' });
}
