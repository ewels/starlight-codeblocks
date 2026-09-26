const groups: [syntax: string[], languages: string][] = [
  [
    ['//', '/* */'],
    'js javascript mjs cjs ts typescript mts cts jsx tsx jsonc json5 rust rs go java kotlin kt kts swift ' +
      'c h cpp c++ hpp cc csharp cs c# groovy nextflow nf scala dart php',
  ],
  [['#'], 'python py sh shell shellscript bash zsh console powershell ps ps1 yaml yml toml ruby rb r perl pl'],
  [['#'], 'makefile make dockerfile docker nix'],
  [['--'], 'sql lua haskell hs'],
  [['<!-- -->'], 'html xml svg markdown md mdx'],
  [['<!-- -->', '//', '/* */'], 'vue svelte astro'],
  [['/* */'], 'css'],
  [['/* */', '//'], 'scss sass less'],
  [['%'], 'tex latex erlang erl'],
  [[';'], 'lisp clojure clj ini'],
];

/** Comment syntax by language. An entry with a space is a block comment: the opener, then the closer. */
export const defaultCommentSyntax: Record<string, string[]> = Object.fromEntries(
  groups.flatMap(([syntax, languages]) => languages.split(' ').map((language) => [language, syntax])),
);

export interface CommentSyntax {
  open: string;
  close?: string;
}

export function commentSyntaxFor(language: string, overrides: Record<string, string[]> = {}): CommentSyntax[] {
  const key = language.toLowerCase();
  const own = (syntaxes: Record<string, string[]>) => (Object.hasOwn(syntaxes, key) ? syntaxes[key] : undefined);
  const syntax = own(overrides) ?? own(defaultCommentSyntax) ?? [];
  return syntax.map((entry) => {
    const [open = '', close] = entry.trim().split(/\s+/);
    return { open, close };
  });
}
