# Contributing

Issues and pull requests are welcome.

## Set up

```sh
pnpm install
pnpm build
pnpm --filter docs dev
```

The docs site uses the package from `packages/starlight-codeblocks/dist`, so run `pnpm build` again after each change to the package.

Before you open a pull request, run `pnpm lint`, `pnpm test`, `pnpm docs:build` and `pnpm lint:docs`. [AGENTS.md](AGENTS.md) has all the commands and the rules for code changes.

## Translations

The buttons, labels and screen reader texts of the plugin are in `packages/starlight-codeblocks/src/languages/`, in a file for each language, such as `de.ts`. The English texts are `uiStrings` in `packages/starlight-codeblocks/src/translations.ts`.

To correct a translation, change the text in the file of the language. Keep each name in double braces, such as `{{count}}`, because the plugin fills in its value.

To add a language:

1. Copy a file, such as `de.ts`, to a file with the code of the new language, such as `nl.ts`. Use the code that Starlight uses for the language.
2. Translate each text. For words that Starlight also shows, such as "Copied" and "Next", use the words from [the Starlight translation](https://github.com/withastro/starlight/tree/main/packages/starlight/translations) for the language.
3. Give a text with a count a key for each plural form of the language, with the suffixes from `new Intl.PluralRules('nl').resolvedOptions().pluralCategories`. English has `_one` and `_other`, and Polish also has `_few` and `_many`.
4. Import the file in `languages/index.ts` and add it to `languages`. If sites use other codes for the same table, such as `pt-BR` for `pt`, add them to `languageAliases`.
5. Add each new code to the list in `skills/starlight-codeblocks/references/configuration.md`. The list in the docs comes from `languages/index.ts`.
6. Run `pnpm --filter starlight-codeblocks exec vitest run test/languages.test.ts`. The test checks the keys, the plural forms, the placeholders, the import in `index.ts` and the list in the skill.

To add a new text to the plugin, add the English text to `uiStrings` and a translation to the file of each language.
