# Architecture questions

Answer these in phase 1, before any feature code. Test each one with a small experiment on the current versions of Astro, Starlight and Expressive Code. Write the answers, with evidence, to `design/ARCHITECTURE.md`.

What we already know from Expressive Code 0.44.2:

- A plugin can define `hooks` (`preprocessMetadata`, `preprocessCode`, `performSyntaxAnalysis`, `postprocessAnalyzedCode`, `annotateCode`, `postprocessRenderedLine`, `postprocessRenderedBlock`, `postprocessRenderedBlockGroup`), `styleSettings`, `baseStyles` and `jsModules`.
- `codeBlock.parentDocument.sourceFilePath` gives the page's file path.
- `codeBlock.language` is writable, and lines can be inserted, deleted and edited in the preprocessing hooks.
- The frames plugin stores the copy text in a `data-code` attribute on the copy button, with newlines encoded as the character U+007F. It builds that text from `codeBlock.code`.
- Starlight bundles Expressive Code and processes code blocks through a Sätteri HAST plugin when Sätteri is the Markdown processor.

## Q1. How does the Starlight plugin register Expressive Code plugins?

Find out whether a Starlight plugin can add Expressive Code plugins with `updateConfig({ expressiveCode: … })` in its `config:setup` hook, and whether that still works when:

- the site also has an `ec.config.mjs` file with its own plugins, and
- a page uses Starlight's `<Code>` component, which needs a configuration it can serialise.

Test: a site with the Starlight plugin, an `ec.config.mjs` that adds one unrelated plugin, and a page with both a fenced block and a `<Code>` component.

Fallback: if the two cannot coexist, the Starlight plugin writes nothing to the Expressive Code configuration. Instead, the docs tell users to add the preset to `ec.config.mjs` in one line. Keep the one-line `codeblocks()` set-up for sites that have no `ec.config.mjs`, if that works.

## Q2. Can the Starlight plugin register Sätteri plugins?

The code switcher needs a directive, and inline highlighting needs to change inline code. Find out:

- how Sätteri mdast and hast plugins are written (the `satteri-*` community packages are examples),
- whether a Starlight plugin can add them (for example through an Astro integration from `addIntegration`, calling `updateConfig` on `markdown.processor`),
- whether `:::code-switcher{sync="pm"}` parses as a container directive under Sätteri with Starlight's directive support, with fenced code blocks as children, and
- whether Expressive Code still renders those child code blocks.

Fallback: build the code switcher as an MDX component. Inline highlighting then depends on Q5.

## Q3. Can an Expressive Code plugin change the copied text?

Smart shell copy, placeholders and directive stripping all change what the copy button copies. Find out whether a plugin can overwrite the copy button's `data-code` attribute in `postprocessRenderedBlock`, or whether changing `codeBlock.code` in an earlier hook is enough.

Directive removal happens in `preprocessCode`. Check whether the frames plugin then sees clean code without any other change.

Fallback: a client module that sets the clipboard text on the copy button's click, before the frames plugin's handler runs.

## Q4. How do client modules reach the page?

Find out:

- when Expressive Code's `jsModules` run, and on which pages,
- whether a module in `jsModules` can load other modules with a dynamic `import()` that Vite resolves and bundles,
- whether Starlight's plugin API or an Astro integration (`injectScript`) is a better route, and
- how to load a feature's module only on pages that contain that feature. For example, the Expressive Code plugin adds a data attribute to the block, and a small loader imports the modules for the attributes it finds.

Choose one route for all features and record it.

## Q5. Where can inline code highlighting hook in?

Sätteri runs its highlighter before any hast plugins. Find out:

- whether a Sätteri mdast plugin can see inline code with a `{:lang}` suffix, before the highlighter runs,
- whether that plugin can call a highlighter itself (Expressive Code's engine, or Shiki with the same themes), synchronously or asynchronously, and
- whether it can replace the inline code with HTML.

Report each option you tried. If none works, mark phase 10 as blocked and continue.

## Q6. How do the MDX components get their code?

`<CodeSteps>` and `<Scrollycoding>` wrap fenced code blocks. Find out:

- whether an Astro component receives its children as HTML rendered by Expressive Code, like Starlight's `<Tabs>`,
- how `<CodeSteps>` can get token data for each step, either by reading Expressive Code's rendered token spans or by running the highlighter again with the same theme, and
- which `@shikijs/magic-move` entry point accepts precompiled tokens and renders them without Shiki in the browser.

## Q7. Line numbers

Line permalinks need line numbers. Starlight does not include Expressive Code's line numbers plugin by default. Find out whether the Starlight plugin can add `@expressive-code/plugin-line-numbers` without duplicating it for sites that already use it, and whether `id` can turn line numbers on for one block.

## Q8. Theme colours

The hover card, inline highlighting and the new tints need the site's Expressive Code theme colours for both themes. Find out how a plugin reads the active themes and their colours, and how Starlight switches between them (Expressive Code's `themeCssSelector`).

## Q9. starlight-pydocs data

The Python adapter uses the project's own API data from starlight-pydocs. Find out what starlight-pydocs exposes at build time: a data file, a content collection, or an API. If it exposes nothing, generate an `objects.inv`-style inventory from Griffe output as a fallback, and record the gap.
