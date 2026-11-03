import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { languageAliases, languages } from '../src/languages/index.ts';
import { uiStrings } from '../src/translations.ts';

const PLURAL = /_(zero|one|two|few|many|other)$/;
const base = (key: string) => key.replace(PLURAL, '');
const english: Record<string, string> = uiStrings;
const counted = new Set(
  Object.keys(english)
    .filter((key) => PLURAL.test(key))
    .map(base),
);
const placeholders = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map(([, name]) => name).sort();
const codes = Object.entries(languages).flatMap(([code, texts]) =>
  [code, ...(languageAliases[code] ?? [])].map((alias) => [alias, texts] as const),
);

test.each(codes)('the %s table has every key, the plural forms of the language and the placeholders', (code, texts) => {
  const categories = new Intl.PluralRules(code).resolvedOptions().pluralCategories;
  const expected = Object.keys(english)
    .map(base)
    .filter((key, i, all) => all.indexOf(key) === i)
    .flatMap((key) => (counted.has(key) ? categories.map((category) => `${key}_${category}`) : [key]));
  expect(Object.keys(texts).sort()).toEqual(expected.sort());
  for (const [key, text] of Object.entries(texts)) {
    const source = english[key] ?? english[`${base(key)}_other`] ?? '';
    expect(placeholders(text), `${code} ${key}`).toEqual(placeholders(source));
    expect(text, `${code} ${key}`).toBe(text.trim());
    expect(text, `${code} ${key}`).not.toContain('...');
  }
});

test('the index registers every language file', () => {
  const files = readdirSync(new URL('../src/languages/', import.meta.url))
    .filter((file) => file !== 'index.ts')
    .map((file) => file.replace(/\.ts$/, ''));
  expect(Object.keys(languages).sort()).toEqual(files.sort());
});

test('the agent skill lists every code', () => {
  const skill = readFileSync(
    new URL('../../../skills/starlight-codeblocks/references/configuration.md', import.meta.url),
    'utf8',
  );
  expect(codes.map(([code]) => code).filter((code) => !skill.includes(`\`${code}\``))).toEqual([]);
});

test('codes and aliases are unique', () => {
  const all = codes.map(([code]) => code);
  expect(new Set(all).size).toBe(all.length);
  expect(all).not.toContain('en');
});
