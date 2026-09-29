import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expect, test } from 'vitest';
import type { CodeblocksPlugin } from '../src/expressive-code/core.ts';
import { createPlugins } from '../src/expressive-code/index.ts';
import { optionsReference, resolveOptions } from '../src/options.ts';
import { attributesReference } from '../src/reference.ts';

const dir = join(import.meta.dirname, '../../../skills/starlight-codeblocks');
const files = (readdirSync(dir, { recursive: true }) as string[]).filter((file) => file.endsWith('.md'));
const skill = files.map((file) => readFileSync(join(dir, file), 'utf8')).join('\n');
const main = readFileSync(join(dir, 'SKILL.md'), 'utf8');
const docs = 'https://ewels.github.io/starlight-codeblocks/';

const directives = createPlugins(resolveOptions()).flatMap((plugin) =>
  Object.entries((plugin as CodeblocksPlugin).directives ?? {}),
);
const pages = new Set([
  ...Object.values(optionsReference).map((feature) => feature.page),
  ...attributesReference.map((attribute) => attribute.page),
  ...directives.flatMap(([, spec]) => spec.docs?.page ?? []),
]);

test('has front matter that the Agent Skills spec accepts', () => {
  const front = main.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? '';
  expect(front).toMatch(/^name: starlight-codeblocks$/m);
  const description = front.match(/^description: (.+)$/m)?.[1] ?? '';
  expect(description.length).toBeGreaterThan(0);
  expect(description.length).toBeLessThanOrEqual(1024);
  expect(main.split('\n').length).toBeLessThan(500);
});

test('links only to reference files that exist', () => {
  for (const [, path] of main.matchAll(/\]\((references\/[^)]+)\)/g)) {
    expect(existsSync(join(dir, path as string)), path).toBe(true);
  }
  for (const file of files.filter((file) => dirname(file) === 'references')) {
    expect(main, `link to ${file} from SKILL.md`).toContain(`](${file})`);
  }
});

test('links to every feature page, and describes every attribute, directive and option', () => {
  const missing = [
    ...[...pages].map((page) => `${docs}${page}/`),
    ...attributesReference.flatMap((attribute) => attribute.syntax).map((syntax) => `\`${syntax}\``),
    ...directives.map(([name]) => `[!${name}`),
    ...Object.keys(optionsReference).map((key) => `\`${key}\``),
  ].filter((text) => !skill.includes(text));
  expect(missing, 'add these to skills/starlight-codeblocks').toEqual([]);
});
