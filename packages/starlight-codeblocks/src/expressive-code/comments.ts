import { bundledLanguage } from './core.ts';

const groups: [syntax: string[], languages: string][] = [
  [
    ['//', '/* */'],
    'js javascript mjs cjs ts typescript mts cts jsonc json5 rust rs go java kotlin kt kts swift ' +
      'c h cpp c++ hpp cc csharp cs c# groovy nextflow nf scala dart php',
  ],
  [['//', '/* */', '{/* */}'], 'jsx tsx'],
  [
    ['#'],
    'python py pycon sh shell shellscript bash zsh console powershell ps ps1 yaml yml toml ruby rb r perl pl ' +
      'makefile make dockerfile docker nix',
  ],
  [['--'], 'sql lua haskell hs'],
  [['<!-- -->'], 'html xml svg markdown md mdx'],
  [['<!-- -->', '//', '/* */'], 'vue svelte astro'],
  [['/* */'], 'css'],
  [['/* */', '//'], 'scss sass less'],
  [['%'], 'tex latex erlang erl'],
  [[';'], 'lisp clojure clj ini'],
];

/** Languages grouped by their default comment syntax. */
export const commentSyntaxGroups = groups.map(([syntax, languages]) => ({ syntax, languages: languages.split(' ') }));

/** Comment syntax by language. An entry with a space is a block comment: the opener, then the closer. */
const defaultCommentSyntax: Record<string, string[]> = Object.fromEntries(
  commentSyntaxGroups.flatMap(({ syntax, languages }) => languages.map((language) => [language, syntax])),
);

export interface CommentSyntax {
  open: string;
  close?: string;
}

export function commentSyntaxFor(language: string, overrides: Record<string, string[]> = {}): CommentSyntax[] {
  const key = language.toLowerCase();
  const info = bundledLanguage(key);
  const keys = [key, ...(info ? [info.id, ...(info.aliases ?? [])] : [])];
  const own = (syntaxes: Record<string, string[]>) =>
    keys.map((k) => (Object.hasOwn(syntaxes, k) ? syntaxes[k] : undefined)).find(Boolean);
  const syntax = own(overrides) ?? own(defaultCommentSyntax) ?? [];
  return syntax.map((entry) => {
    const [open = '', close] = entry.trim().split(/\s+/);
    return { open, close };
  });
}
