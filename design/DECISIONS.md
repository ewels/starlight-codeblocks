# Decisions

Record each decision that the design pack does not settle. Add new entries at the bottom.

Use this format:

```
## <short title>

- Date: YYYY-MM-DD
- Step: <plan step>
- Decision: <what you chose>
- Reason: <why>
- Alternatives: <what you rejected, and why>
```

## Work on main instead of initial-build

- Date: 2026-09-25
- Step: 0.1
- Decision: All work happens on `main`. The `initial-build` branch in `AGENTS.md` and the stale PROGRESS row 0.2 are not used.
- Reason: The design pack was already committed and pushed to `main`, and the head session directs work on `main`.
- Alternatives: A separate `initial-build` branch. Rejected by the head session.

## Register Expressive Code plugins automatically, with ec.config.mjs as the fallback

- Date: 2026-09-25
- Step: 1.2
- Decision: `codeblocks()` adds its Expressive Code plugins with `updateConfig`, with every property except `name` made non-enumerable, and overrides `virtual:astro-expressive-code/ec-config` so that `<Code>` gets the real plugins from a `globalThis` registry. If `ec.config.mjs` has a `plugins` key, the author must add `pluginCodeblocks()` to it, and the build fails with that instruction until they do. `pluginCodeblocks()` with no argument uses the options given to `codeblocks()`.
- Reason: Plain `updateConfig` breaks `<Code>` (non-serialisable options) and loses the plugins when `ec.config.mjs` has `plugins` (arrays are replaced in the merge). The hidden-property route keeps the one-line set-up for sites without such a file, and the fallback is the documented Expressive Code route. See ARCHITECTURE.md, Q1.
- Alternatives: Always require `ec.config.mjs` (breaks the one-line set-up in SPEC section 3). Wrapping the `astro-expressive-code` integration hooks or Node module loader hooks to inject into the file's plugins (too fragile).

## Keep all options in codeblocks() on Starlight sites

- Date: 2026-09-25
- Step: 1.2
- Decision: On Starlight sites, options go to `codeblocks(options)` only, also when the preset is in `ec.config.mjs`. The preset reads them from the registry.
- Reason: One place for options. Starlight-only features (code switcher, inline highlighting, components) need the same options.
- Alternatives: Split options between the two calls (confusing).

## Client modules: one loader in jsModules, feature files emitted as assets

- Date: 2026-09-25
- Step: 1.2
- Decision: One loader string in `jsModules` imports prebuilt feature modules that the integration emits next to `ec.*.js`. Components use Astro `<script>`.
- Reason: `jsModules` load only on pages with code blocks, in a file the page already loads for the copy button. `injectScript('page')` loads on every page, which breaks the rule "no client JavaScript on a page with no interactive features". See ARCHITECTURE.md, Q4.
- Alternatives: `injectScript('page')` with a loader (loads everywhere). All feature code inline in `jsModules` (every code page gets every feature's bytes).

## Code switcher as a Sätteri directive

- Date: 2026-09-25
- Step: 1.2
- Decision: Build `:::code-switcher` as a Sätteri container directive. No MDX component.
- Reason: The spike shows that the directive parses in `.md` and `.mdx`, the code children reach Expressive Code, and the plugin can pass data to each child through its meta string.
- Alternatives: `<CodeSwitcher>` MDX component (only needed if the directive failed).

## Inline highlighting uses an Expressive Code engine with the site's themes

- Date: 2026-09-25
- Step: 1.2
- Decision: The Sätteri mdast plugin highlights inline code with `new ExpressiveCode()` from `expressive-code`, using the theme objects captured from the site's real engine. In MDX, authors write `\{:lang}`.
- Reason: Same themes and contrast correction as the code blocks. MDX parses `{:lang}` as an expression and fails the build, so the escape is required there.
- Alternatives: Shiki directly (needs its own theme loading and skips Expressive Code's contrast correction).

## Line numbers from the permalinks plugin, not plugin-line-numbers

- Date: 2026-09-25
- Step: 1.2
- Decision: The plugin never adds `@expressive-code/plugin-line-numbers`. Blocks with `id` get a gutter of link numbers from the permalinks plugin, which also removes the other plugin's numbers from those blocks.
- Reason: Adding the plugin turns numbers on for every block. Our own gutter gives links, which the other plugin cannot.
- Alternatives: Add the plugin and set `defaultProps.showLineNumbers: false` (changes the site's config and duplicates a plugin that the site can already have).

## starlight-pydocs data through the Griffe dump

- Date: 2026-09-25
- Step: 1.2
- Decision: The Python adapter reads the Griffe dump (explicit `dump` path, or the newest `starlight-pydocs/<package>-*/dump.json` in the cache folder) and maps objects to URLs with the pydocs URL scheme.
- Reason: starlight-pydocs 0.2.1 has no Node API, no data file with a stable path and no content collection. Its endpoints exist only in the built site, and its TypeScript exports run only inside Vite. The dump also gives signatures and summaries, which `objects.inv` does not. Gap: starlight-pydocs needs a small Node API (for example `getSymbols(options)` that returns path, kind, href, signature and summary). The same maintainer owns both packages, so this is a candidate upstream change.
- Alternatives: Fetch `objects.inv` of the deployed site (stale, and missing on the first build). Import `starlight-pydocs/render` (fails outside Vite).

## Biome for code lint, TypeScript 6 for type checks

- Date: 2026-09-25
- Step: 2.1
- Decision: `pnpm lint` runs `biome check` (lint and format) and then `typecheck` in each workspace package: `tsc --noEmit` in the plugin and `astro check` in the docs site. TypeScript is pinned to 6.0.3. Biome does not check `.astro`, `.md` and `.mdx` files, or the design pack.
- Reason: TypeScript 7 is the latest release, but `@astrojs/check` and `typescript-eslint` accept only TypeScript 5 and 6. Biome is one dependency with no TypeScript peer and no plugin set to keep in step.
- Alternatives: ESLint flat config with `typescript-eslint` (more packages, blocked on TypeScript 7 in the same way).

## tsdown for the package build

- Date: 2026-09-25
- Step: 2.1
- Decision: Build the package with tsdown 0.23 (ESM, `.mjs` and `.d.mts`).
- Reason: The plan allows tsup or tsdown. tsdown is the maintained successor of tsup and accepts TypeScript 5 to 7.
- Alternatives: tsup (in maintenance mode).

## Docs site build without warnings

- Date: 2026-09-25
- Step: 2.1
- Decision: The docs site has an `i18n` collection with an empty `en.json`, `site` and `base` for GitHub Pages (`https://ewels.github.io/starlight-codeblocks/`), `disable404Route: true` with its own `src/pages/404.astro` (a `StarlightPage`), and a Rolldown `onLog` filter for the `MODULE_LEVEL_DIRECTIVE` warning about `use astro:head-inject`. The `build` script deletes `node_modules/.astro` (the content data store) before `astro build`.
- Reason: A bare Starlight site prints four warnings, and the docs build must have none. A `404.md` in the docs collection clashes with the `[...slug]` route, and no `404` entry gives a "not found" warning, so the page lives outside the collection. The directive warning comes from `@astrojs/mdx` on every `.mdx` page and is harmless. `astro build --force` also clears the stale content cache, but prints a warning of its own.
- Alternatives: `astro build --force` (warns). Filter all build warnings (hides real ones).

## Docs linter scope

- Date: 2026-09-25
- Step: 2.4
- Decision: `scripts/lint-docs.mjs` checks every rule in WRITING-STYLE.md section 11, except "key" (as an adjective) and "essential" (as praise). The heading check allows a list of proper nouns in the script and ignores section numbers. Sentence length is reported at the first line of the paragraph or list item. The tests run with `node --test` as part of `pnpm test`.
- Reason: A script cannot tell "key" as an adjective from "the `focus` key", or "essential" as praise from a plain statement of need. Those two, and "-ly" adverbs in general, stay in the manual checklist.
- Alternatives: Flag every "key" and "essential" (false positives on reference pages).

## Docs URLs and page files

- Date: 2026-09-25
- Step: 2.6
- Decision: Pages of the three feature groups and "More" live in `features/`. The other groups use `guides/`, `extend/` and `reference/`. "Getting started" and "Configuration" are at the root. Every page is `.mdx`, so a page can use `Example` without a rename. The sidebar lists each page by slug, in the order of DOCS-SITE.md, so labels come from page titles.
- Reason: Short, stable URLs that do not change if a feature moves between sidebar groups.
- Alternatives: One folder for each sidebar group (URLs change when a page moves group).

## Example component renders with Starlight's Code

- Date: 2026-09-25
- Step: 2.6
- Decision: `docs/src/components/Example.astro` takes `code` (Markdown with one or more fenced blocks). It shows the source under "You write" with `<Code lang="md">`, and each block under "Readers see" with `<Code lang meta>`.
- Reason: DOCS-SITE.md asks for `<Code>` where the plugin works with it, and ARCHITECTURE.md Q1 shows it does once step 3.1 adds the ec-config override. Pages with directives or components (code switcher, token transitions, scrollycoding) use a source block and the live version instead.
- Alternatives: Render with a second Expressive Code engine in the component (duplicates the site config).

## Options: validation and one source for the reference tables

- Date: 2026-09-25
- Step: 3.1
- Decision: `codeblocks(options)` and `pluginCodeblocks(options)` validate options at once with a small hand-written validator in `src/options.ts`. Keys follow SPEC section 3 exactly: a feature with settings takes `false` or an object, and a feature with no settings takes only `false`. `true` is an error with a message that says what to write. The same file exports `optionsReference` (type, default and description of every option), which the docs reference pages read.
- Reason: Clear build errors for unknown keys and wrong types, without a schema dependency in the `/expressive-code` subpath (which must work without Astro). One data source means the options reference cannot drift from the code.
- Alternatives: `astro/zod` (ties the preset to Astro). Accepting `true` (not in the spec type, and two ways to write the default).

## astro is a peer dependency

- Date: 2026-09-25
- Step: 3.1
- Decision: The package lists `astro` (>=7) as a peer dependency next to `@astrojs/starlight`.
- Reason: `codeblocks()` imports `AstroError` from `astro/errors` at run time. Every Starlight site has Astro already.
- Alternatives: Plain `Error` (loses Astro's hint line in the error overlay).

## Root lint and test scripts build the package first

- Date: 2026-09-25
- Step: 3.1
- Decision: `pnpm lint` and `pnpm test` at the root run `pnpm build` first.
- Reason: On a fresh clone, `astro check` in `docs/` cannot resolve `starlight-codeblocks` until `dist/` exists, and the unit tests read the built client modules. The first CI run failed on this.
- Alternatives: A `prepare` script (pnpm 11 does not run it for every install), or a separate CI step (a fresh local clone would still fail).

## Notation runs before Expressive Code reads its own markers

- Date: 2026-09-25
- Step: 3.2
- Decision: The notation plugin parses directives in `preprocessLanguage`, the first hook. It adds `[!code highlight]`, `[!code ++]` and `[!code --]` to `codeBlock.props.mark`, `ins` and `del` as line numbers, so the text markers plugin renders them. In `preprocessMetadata` it moves line annotations from other plugins so that they count the lines that readers see, and in `preprocessCode` it removes the directives and the own-line directive lines. `resolveRange()` counts the same lines.
- Reason: SPEC section 4 says all line numbers count the lines readers see. Expressive Code allows no code edits before `preprocessCode`, and the text markers plugin attaches `{2}` and `ins={3}` to source lines in `preprocessMetadata`, before our plugin runs. Without the move, `{3}` and `focus={3}` could point at different lines in the same block.
- Alternatives: Leave Expressive Code's ranges counting source lines (two numbering schemes in one block). Build our own marker annotations (the text markers annotation class is not exported, and the styles would differ).

## Ranges ignore startLineNumber

- Date: 2026-09-25
- Step: 3.2
- Decision: A range counts lines from 1 at the top of the block. `startLineNumber` does not shift it.
- Reason: Expressive Code's own ranges work the same way, and one block must not have two meanings for `{3}`.
- Alternatives: Shift ranges by `startLineNumber` (differs from `mark`, `ins` and `del`).

## Unknown and misplaced directives stay in the code

- Date: 2026-09-25
- Step: 3.2
- Decision: A directive with an unknown name, a bad `:N`, or an own-line directive at the end of a line of code, gives a build warning and stays in the rendered and copied code as written. A directive with `/<text>/` that does not match its target line gives a warning and has no effect. Directives of features that are turned off are unknown.
- Reason: "Render the line without that directive's effect" (SPEC section 4). The author sees the typo on the page as well as in the build log.
- Alternatives: Remove unknown directives silently (hides typos).

## Features declare their directives on their plugin

- Date: 2026-09-25
- Step: 3.2
- Decision: A feature's Expressive Code plugin has a `directives` property (name to placement and text). The notation plugin collects them from `config.plugins`, so it knows every directive of the plugins in use. Directive text runs to the next directive or to the end of the comment. A line that holds an own-line directive and no code is removed.
- Reason: Features stay self-contained, and a standalone feature plugin works with `pluginNotation()` in any order after it.
- Alternatives: A central directive list in the notation plugin (every feature edits one file).

## Warnings name the block, not the source line

- Date: 2026-09-25
- Step: 3.2
- Decision: Build warnings read `<file>, <language> code block "<title>", line <n>: <message>`, where the line counts from the top of the block.
- Reason: Expressive Code does not know where the fence sits in the source file. The file, the title and the line in the block find it.
- Alternatives: Look up the fence position from the Markdown AST (not available in Expressive Code hooks).

## Comment syntax option

- Date: 2026-09-25
- Step: 3.2
- Decision: `notation.comments` maps a language to a list of comment syntaxes, such as `['//', '/* */']`. An entry with a space is a block comment. The option replaces the entry for that language in the built-in map, and `[]` removes the language. C-family languages also accept `/* */`, and Vue, Svelte and Astro also accept `//` and `/* */`, for their script parts.
- Reason: The option type in SPEC section 3 is `Record<string, string[]>`, which is a list of syntaxes for each language. Script blocks in component files use JavaScript comments.
- Alternatives: One syntax for each language (breaks directives in `<script>` parts).

## Client modules on sites without codeblocks()

- Date: 2026-09-25
- Step: 3.3
- Decision: When `codeblocks()` is not in use (Astro sites without Starlight, or other Expressive Code integrations), the loader in `jsModules` carries the source of every feature module as a string, and imports a module from a `blob:` URL only on pages that use it. With `codeblocks()`, the loader imports hashed files that the integration emits next to `ec.<hash>.js`. The registry flag `clientAssets` picks the mode when Expressive Code collects `jsModules`.
- Reason: This works with every Expressive Code integration and needs no set-up. The modules still run only on pages that use them. The cost is download size: `ec.<hash>.js` holds all feature code on pages with code blocks. Starlight sites, the main target, do not pay it.
- Alternatives: An exported Astro integration for preset-only sites (Astro only, and one more line of set-up). `data:` URLs (a third larger). Always inline (every Starlight page with code would download every feature).

## One build per client module

- Date: 2026-09-25
- Step: 3.3
- Decision: `tsdown.config.ts` builds each `src/client/<feature>.ts` on its own into `dist/client/scb-<feature>.<hash>.js`, minified, with no shared chunks. Shared helpers in `src/client/shared/` are bundled into each module that imports them. A module's default export runs when the loader imports it and again on every `astro:page-load`, so it must skip elements it has already set up.
- Reason: A file with no imports works in both loader modes (files and `blob:` URLs), and the 3 kB budget applies to what a page downloads for the feature. The helpers are small.
- Alternatives: Shared chunks (relative imports break in `blob:` modules).

## Positioning helper

- Date: 2026-09-25
- Step: 3.3
- Decision: `place(floating, anchor)` in `src/client/shared/position.ts` gives the anchor a unique `anchor-name` and uses `position-area: block-end span-inline-end` with `flip-block` and `flip-inline` fallbacks (the `scb-float` class, from the core plugin). Where `position-area` is not supported, a script sets `top` and `left` and follows scroll and resize. The helper never moves elements: popovers and cards stay inside the block's `.expressive-code` element (ARCHITECTURE.md Q8).
- Reason: SPEC section 2 asks for CSS anchor positioning with a small script fallback. Keeping the element in the block keeps the theme's custom properties.
- Alternatives: A positioning library such as Floating UI (a dependency, and over the budget for one feature).

## Style settings: one shared group, one group for each feature

- Date: 2026-09-25
- Step: 3.4
- Decision: Shared tokens live in the `codeblocks` style settings group (`accent`, `accentForeground`, `mutedForeground`, `focusRing`, and the `popover…` settings), declared by the core plugin. Each feature declares its own group, named `codeblocks<Feature>` (for example `codeblocksFocus.blur`). Colours are `[dark, light]` pairs. The dark values are the mockup colours; the light values were chosen for the same contrast, and a unit test checks every pair against the code backgrounds of Starlight's and Expressive Code's default themes.
- Reason: Expressive Code style settings have two levels only (`group.key`), and a group's type can be declared only once. A group for each feature keeps each feature in its own file, and `styleOverrides: { codeblocksFocus: { blur: '2px' } }` reads clearly.
- Alternatives: One group with prefixed keys such as `codeblocks.focusBlur` (one central type that every feature edits). Colours derived from theme colours (the mockups give fixed colours, and derived colours give no contrast guarantee).
- Superseded (2026-09-28): the colours are no longer `[dark, light]` pairs of fixed values. See "Colours come from the Expressive Code theme".

## Class prefix scb

- Date: 2026-09-25
- Step: 3.4
- Decision: Classes start with `scb-` and data attributes with `data-scb-`, from **s**tarlight-**c**ode**b**locks. The core plugin styles `scb-float` (popovers and hover cards), `scb-sr-only` (text for screen readers) and `scb-no-print`, gives every `scb-` element a focus ring, and stops transitions and animations of `scb-` elements under `prefers-reduced-motion: reduce`.
- Reason: SPEC section 2 asks for one prefix from the package name. Three letters keep the HTML small. The shared rules give every feature the keyboard, motion and print behaviour of SPEC section 5 without extra code.
- Alternatives: `starlight-codeblocks-` (long in every class), `sc-` (clashes with styled-components).

## Docs: generated reference tables, examples in exports, absolute links

- Date: 2026-09-25
- Step: 3.5
- Decision: The options, directives and comment syntax tables are Astro components in `docs/src/components/` that read `optionsReference`, the `directives` of the plugins from `createPlugins()` (with their `docs` field) and `defaultCommentSyntax` from the package source. Each `<Example>` gets its Markdown from an `export const` in the page. Links between pages are absolute and start with the base, `/starlight-codeblocks/`. The docs site sets `notation.comments` to `[]` for `md`, `markdown` and `mdx`, so Markdown blocks show directives as written.
- Reason: DOCS-SITE.md asks for reference tables that cannot drift from the code. MDX removes the indentation of continuation lines in a JSX attribute expression, but keeps it in an `export`. `starlight-links-validator` rejects relative links. On this site a Markdown block always shows source for authors, and the "You write" pane of `<Example>` would otherwise lose its `<!-- [!code …] -->` directives.
- Alternatives: Hand-written tables (drift). Template literals in the attribute (lost indentation). A per-block attribute that turns notation off (not in the spec).

## Focus: the code element takes keyboard focus

- Date: 2026-09-25
- Step: 4.1
- Decision: A block with focused lines gets `tabindex="0"` on `pre > code`, with the same focus outline as Expressive Code's `pre`. Hover and keyboard focus anywhere in the frame (title bar, code, copy button) show every line.
- Reason: SPEC 6.1 asks for a focusable code area. Expressive Code's tabindex script removes `tabindex` from a `pre` that does not scroll, so it cannot go there. Focus needs no client JavaScript.
- Alternatives: `tabindex` on the `pre` (removed at run time). A client module that restores it (JavaScript for a CSS-only feature). A block that scrolls sideways now has two tab stops (the `pre` from Expressive Code and the `code`); this is accepted.

## Line states: one colour for each state, the rest derived

- Date: 2026-09-25
- Step: 4.2
- Decision: Each state has one style setting for its colour (`codeblocksLineStates.<state>`, a dark and light pair) and three derived settings: `<state>Background` (15 % alpha), `<state>LabelBackground` (20 % alpha) and `<state>LabelForeground` (the colour mixed with the code foreground, raised to 5:1 contrast on the label). Built-in colours: error `#ff6b6b`/`#d03535`, warning `#f5b942`/`#a3690a`, info `#6cb8ff`/`#2369c0`. The bar reuses Expressive Code's line border (`--ecLineBrdCol`), 3 px wide. The label uses the code font, as in the mockups.
- Reason: Custom states give only one colour pair (SPEC 6.2), so built-in and custom states must derive tints the same way. Derived settings still accept `styleOverrides`. A unit test checks the contrast of every derived colour.
- Alternatives: Separate hand-picked settings for each built-in state (custom states would look different). `color-mix()` in CSS (no build-time contrast check).

## Line states: names, messages and screen readers

- Date: 2026-09-25
- Step: 4.2
- Decision: A state name uses lower-case letters, digits and hyphens, and cannot be the name of another attribute or directive (`title`, `focus`, `hidden`, `hide`, `highlight` and others). A custom state with a built-in name replaces that state's label and colour. `[!code <state>:N] <message>` shows the message on the first line only. Each state line starts with a hidden `scb-sr-only` prefix such as "Error:" (all states, joined with commas, when a line has more than one). The state name in a label is `aria-hidden`, so screen readers do not hear it twice. Labels and prefixes have `user-select: none`. The docs site defines a `todo` state for its examples.
- Reason: The name is also a CSS class and a style setting key, and must not change the meaning of another attribute. SPEC 5 says line-state labels must not appear in a manual copy.
- Alternatives: Messages on every line of `:N` (repeats text). Labels as CSS `content` (not read by every screen reader).

## GitHub Pages deploy workflow added

- Date: 2026-09-25
- Step: 2.5 / 12 (deferred)
- Decision: Added `.github/workflows/deploy-docs.yml`, deferred from step 2.5 per DOCS-SITE.md. It builds `docs/dist` with `pnpm docs:build` and deploys it with `actions/configure-pages`, `actions/upload-pages-artifact` and `actions/deploy-pages`, on push to `main` and `workflow_dispatch`. Setup steps (checkout, pnpm, node with pnpm cache) mirror `ci.yml`. Build and deploy are separate jobs with minimal permissions each (`contents: read` for build; `pages: write` and `id-token: write` for deploy), a `pages` concurrency group, and actions pinned to SHAs via `actions-up`. `zizmor` reports no findings.
- Reason: DOCS-SITE.md asks for the workflow to exist but not run during the initial build, since nothing pushes to `main` yet. The repository has no GitHub Pages site configured yet (`gh api repos/ewels/starlight-codeblocks/pages` returns 404), so someone needs to enable Pages with source "GitHub Actions" in repository settings before this workflow can deploy.
- Alternatives: A single job doing build and deploy together (wider permissions in one place, no benefit here).

## Word-level diff: annotations, not a second highlighter pass

- Date: 2026-09-25
- Step: 4.3
- Decision: A run of `del` lines is paired with the run of `ins` lines directly below it, one by one, by reading each line's existing text-markers annotation (duck-typed by its `markerType` property, since the class itself is not exported). Each pair is tokenised into words, whitespace runs and single punctuation characters, compared with a longest-common-subsequence diff, and the changed ranges get one `ExpressiveCodeAnnotation` each with an inline range, added in the `annotateCode` hook. Similarity is `2 × matched characters / (length of both lines)`; below `wordDiff.minSimilarity` (default 0.4), no annotation is added and the pair keeps its whole-line tint only.
- Reason: `annotateCode` runs after the text-markers plugin has already turned `diff` syntax, `ins`/`del` attributes and `[!code ++/--]` into per-line annotations, so one code path covers every source in SPEC 6.9. Adding our own `ExpressiveCodeAnnotation` reuses Expressive Code's own span-splitting, so the underlying syntax colours survive untouched, with no second Shiki pass and no hast surgery.
- Alternatives: Reading `codeBlock.props.ins`/`del` directly (misses `diff`-syntax blocks, whose markers are added later, in `preprocessCode`, not through `props`). Colouring in `postprocessRenderedLine` by walking the rendered line's text nodes (reimplements the span-splitting that annotations already do).

## Visible whitespace: a hidden marker element, not `::before` alone

- Date: 2026-09-25
- Step: 4.4
- Decision: Each space or tab gets an `ExpressiveCodeAnnotation` that wraps the real character in `<span class="scb-ws">`, with an empty `<span aria-hidden="true">` placed first. The dot or arrow is a CSS `content` value on that empty span, absolutely positioned over the real character (`inset: 0` inside a `position: relative` wrapper). A tab is `display: inline-block; width: 4ch`, matching the mockup.
- Reason: The real character stays as ordinary text, so the copy button and a manual selection both give it unchanged (SPEC 5 and 6.10). Putting the glyph on its own `aria-hidden` element, rather than relying on browsers to leave plain CSS-generated content out of the accessibility tree, is unambiguous.
- Alternatives: `::before` directly on the character's own span, with no marker element (accessibility-tree treatment of generated content is inconsistent across browsers).

## Astro Expressive Code expands tabs to spaces by default

- Date: 2026-09-25
- Step: 4.4
- Decision: The docs site sets `expressiveCode: { tabWidth: 0 }` in its Starlight config, so tabs in fenced code and in `<Code>` reach the plugin unchanged.
- Reason: `astro-expressive-code` replaces every tab with `tabWidth` spaces (default 2) before any Expressive Code plugin hook runs. Without turning this off, a real tab written by an author can never reach `pluginWhitespace()`, the visible-whitespace example for Make could not show its arrow glyph, and copying that example would silently turn its required tab into two spaces. `pluginWhitespace()` itself makes no assumption about this option: sites that need tab expansion elsewhere keep the default and lose only the tab-versus-space distinction, which then renders as several space glyphs.
- Alternatives: Leaving the site default (breaks the Makefile example both visually and on copy). Asking authors to write a literal tab through an escape in Markdown (Markdown has no such escape for fenced code).

## Colourised brackets: a language-agnostic string and comment scanner

- Date: 2026-09-25
- Step: 4.5
- Decision: `findBrackets()` walks the plain text of the block once, tracking string quotes (`'`, `"`, `` ` ``, with backslash escapes; single and double quotes reset at the end of a line, backticks do not) and the block's comment syntax from `commentSyntaxFor()`, and pairs `()`, `[]` and `{}` with a stack. Only a bracket that is actually closed gets coloured; an unmatched bracket, on either side, is left alone. This is the first feature with its own client module: `src/client/brackets.ts` outlines the hovered bracket and its partner by matching `data-scb-pair`, delegated from one listener per block. Caret-based matching is not built, because SPEC 6.11 makes it optional.
- Reason: SPEC 6.11 asks that brackets in strings and comments keep their normal colour, but Expressive Code exposes no token-scope API to plugins, and a full grammar for every language is out of proportion to the feature. The mockup's own bracket transformer uses the same kind of approximation. Depth colouring uses `ExpressiveCodeAnnotation` per bracket, the same mechanism as word-level diff, so syntax highlighting is untouched.
- Alternatives: `@shikijs/colorized-brackets` (the design pack's own mockup notes record that it cannot be used directly on this stack). A full per-language tokeniser (far more code for a decorative feature).

## Hidden lines: force the title bar with :has(), no dedicated colours

- Date: 2026-09-25
- Step: 4.6
- Decision: `pluginHiddenLines()` rebuilds `pre > code`'s children in `postprocessRenderedBlock`, inserting a `scb-hidden-marker` button before each run of hidden lines and giving every hidden line an id, so each marker's `aria-controls` names its own lines. The title bar button lives in `figcaption.header`, whose `display: none` default (when a block has no title or terminal frame) is overridden with `.frame:not(.has-title):not(.is-terminal):has(.scb-hidden-toggle) .header { display: flex; … }`, so a block with no title still gets a bar for the toggle. Colours reuse the shared `codeblocks.mutedForeground`/`codeForeground`/`codeBackground`/`borderColor` tokens through CSS `color-mix()`, with no new style settings group.
- Reason: SPEC 6.7 asks for the button "in the title bar" even though `hidden={…}` needs no title of its own. `:has()` is Baseline-supported and keeps the change scoped to blocks that actually have hidden lines, without touching `astro-expressive-code`'s own header markup. A dedicated colour group would need dark and light values and a contrast test for what is only a faint, decorative background and a dashed rule, neither of which carries meaning on its own (SPEC 5's colour rule is about meaning, not decoration).
- Alternatives: Always require a title for hidden lines (contradicts the spec's own attribute-only syntax). A style settings group for the marker and the forced header background (over-specified for two decorative tints that already track the block's own foreground and background).

## Shared scb-btn utility class

- Date: 2026-09-25
- Step: 4.6
- Decision: Added `.scb-btn` to the core plugin's `baseStyles` in `styles.ts`: a small bordered, tinted pill button, coloured from `codeblocks.mutedForeground`/`codeForeground`/`borderColor`. The hidden-lines title bar toggle adds it alongside its own class.
- Reason: The feature needed the same small button look that the mockups give their title bar tools (SPEC's mockups win on look and feel where the spec gives no value), and expandable blocks (step 4.7) and future title-bar buttons (playground, run) will need the same look. One class avoids repeating the same six lines of CSS in every feature that adds a button outside a line.
- Alternatives: Repeat the button CSS in each feature file (drift between features, as one feature file's tweak would not reach another's identical-looking button).

## Expandable blocks: collapsing lives entirely in the client module

- Date: 2026-09-25
- Step: 4.7
- Decision: `pluginExpandable()` only marks a qualifying block with `data-scb-expandable="N"`; it renders no collapsed markup and no `hidden` attribute at build time. `src/client/expandable.ts` sets `hidden="until-found"` on the lines past `N` and listens for `beforematch` on them to expand. The fade (`pre.scb-expandable-collapsed::after`) and the "Show all/fewer lines" bar are wrapped in `@media (scripting: enabled)` and `@media (scripting: none)`.
- Reason: SPEC 6.14 requires the block to show in full without JavaScript. `hidden="until-found"` is a native HTML feature that hides its element with no script needed, so setting it at build time would collapse the block even with JavaScript off, which fails that requirement. Building the collapse only in the client, behind the same `scripting` media feature that Expressive Code's own copy button uses to hide itself, is the only way to get both the native find-in-page behaviour SPEC 6.14 asks for and a fully expanded block with no script.
- Alternatives: A CSS `max-height`/`overflow: hidden` clip set at build time (visually collapses the block even with JavaScript off, and find-in-page cannot reveal `overflow: hidden` content the way it reveals `hidden="until-found"`). Rendering the button only in the client (loses the disclosure pattern for screen readers before the module loads, and needs the same `scripting: none` guard anyway for the fade).

## Example component reverts to stacked panes, output and Markdown both visible

- Date: 2026-09-25
- Step: docs polish (user feedback)
- Decision: Supersedes "Example component shows output and Markdown as tabs, one feature per example" below. `docs/src/components/Example.astro` goes back to two stacked panes, "You write" (the Markdown source) above "Readers see" (the rendered output), with no `<Tabs>`. The Playwright locator changes to `[role="tabpanel"]` and `[role="tab"]` in `docs/e2e/brackets.test.ts`, `comment-notation.test.ts`, `expandable.test.ts`, `focus.test.ts`, `hidden-lines.test.ts` and `line-states.test.ts` revert to `.pane`. The one-feature-per-page content fixes from that entry (`wordDiff=false` in `comment-notation.mdx`, `focus.mdx` and `getting-started.mdx`; the `[!code error]` removal in `visible-whitespace.mdx`) are unaffected and stay.
- Reason: The user tried the tabs version and reported that clicking back and forth between the "Output" and "Markdown" tabs to compare source and result was annoying, and asked for the original stacked layout back.
- Alternatives: Keeping tabs with a "compare" mode that shows both at once (adds a second layout to build and maintain for a preference the user has already stated plainly).

## Example component shows output and Markdown as tabs, one feature per example

- Date: 2026-09-25
- Step: docs polish (user feedback)
- Decision: `docs/src/components/Example.astro` now renders with Starlight's `<Tabs>`/`<TabItem>` instead of two stacked panes: an "Output" tab (the rendered blocks), selected by default, and a "Markdown" tab (the source) after it. `<Tabs>` gets no `syncKey`, so switching tabs on one page never switches them on another. Every feature page example was audited so it shows only its own feature: `comment-notation.mdx`'s directive example and `getting-started.mdx`'s first-directive example add `wordDiff=false`, because their adjacent `[!code --]`/`[!code ++]` lines otherwise trigger word-level diff's automatic word highlighting, a feature neither page is about. `focus.mdx`'s explicit focus-plus-diff combination example also gets `wordDiff=false`, since its prose announces only two features, not three. `visible-whitespace.mdx`'s two examples drop `[!code error]` in favour of a plain comment with the same words, because a line-state directive is a second, unannounced feature on a page about whitespace glyphs.
- Reason: The user reported that some feature pages showed more than one feature at once by accident, naming comment notation (word-level diff bleeding in) and visible whitespace (a line-state directive) specifically, and asked for output-first tabs matching Starlight's own component instead of a bespoke two-pane layout. Word-level diff has no way to opt out of pairing except `wordDiff=false` on the block, which the plugin already supports; line states have no such automatic trigger, so the fix there is to stop using the directive rather than adding a new option. Playwright locators for `.pane` became `[role="tabpanel"]`; the keyboard-focus test in `focus.test.ts` now starts from the "Output" tab handle instead of a source pane's copy button, because only the default tab's panel is reachable by Tab (the other panel carries `hidden`).
- Alternatives: Adding a plugin option to turn off word-level diff or line states globally for a page (against "no runtime dependencies or options the spec does not name without a decision", and the per-block `wordDiff=false` attribute already exists). Keeping the two-pane layout and only relabelling it (does not meet the user's explicit request for Starlight `<Tabs>`).

## codeblocks() defaults tabWidth to 0

- Date: 2026-09-25
- Step: 4.4 follow-up
- Decision: `codeblocks()` sets `expressiveCode.tabWidth: 0` through its own `updateConfig` call, in the same branch that adds the plugins, unless the site's Starlight config already sets its own `tabWidth`. Sites where `ec.config.mjs` owns the `plugins` list are left alone, as before: `codeblocks()` already treats that file as full manual control, and its own `tabWidth` (or the astro-expressive-code default) applies through `mergeEcConfigOptions`, which lets a value from `ec.config.mjs` win over the integration options either way. The docs site's own `expressiveCode: { tabWidth: 0 }` in `astro.config.mjs`, added in step 4.4, is removed, because the plugin now sets it.
- Reason: `astro-expressive-code` expands every tab to `tabWidth` spaces (default 2) before any Expressive Code plugin hook runs, for fenced code and for `<Code>` (`components/renderer.ts` reads the same merged `tabWidth`). Left at the default, a real tab a site author writes — a Makefile recipe, a tab-indented example — never reaches `pluginWhitespace()` or the copied text. Step 4.4 fixed this only for the docs site. Every other site using `codeblocks()` would hit the same silent corruption, with nothing in the plugin's own code pointing at the cause. Tracing `virtual:astro-expressive-code/config` and `components/renderer.ts` confirmed that a `tabWidth` set through the Starlight `expressiveCode` config (which is exactly where our registration route writes) reaches both the fenced-block path and `<Code>`, and that `ec.config.mjs` still overrides it when a site sets its own value there, since `mergeEcConfigOptions` merges plain scalars by overwriting with whichever source runs last, and `ecConfigFileOptions` always runs after the integration options.
- Alternatives: Leaving the default and documenting the gotcha as a limitation on the visible whitespace page only (the task's own fallback). Rejected because the registration route can fix it for every site, not only readers who reach that one page, and a unit test (`test/starlight.test.ts`) proves both the default and the override work. Also setting `tabWidth: 0` when `ec.config.mjs` owns `plugins` (breaks the existing "leaves the Starlight config alone" contract for sites that already took full manual control of Expressive Code through that file, and `test/starlight.test.ts` already encodes that contract).

## Hidden lines: the marker is a boxed badge, aligned with the code

- Date: 2026-09-25
- Step: 4.6 follow-up (user feedback)
- Decision: `.scb-hidden-marker` is a small `inline-flex` pill (rounded, padded, its own grey background) instead of a full-width flex row with a trailing dashed rule. It sits at `margin-inline-start: codePaddingInline`, the same left padding `.code` uses, so it lines up with the code text of the lines around it. Added a `codeblocksHiddenLines` style settings group with one setting, `badgeBackground`, resolved as `onBackground(setAlpha(codeblocks.mutedForeground, 0.1), codeBackground)`; the badge text reuses `codeblocks.mutedForeground` directly, already contrast-tested elsewhere. A new test checks the pair meets 4.5:1 in both themes.
- Reason: The user compared the first version (plain text plus a dashed line, copied from the mockup) with the comment-notation page's inline `<code>` styling and asked for a small grey box in that style, aligned with the code rather than sitting flush at the block's left edge. `onBackground(setAlpha(...))` is the same derivation `line-states.ts` uses for its own tinted backgrounds, so the badge follows the codebase's existing pattern for a colour that must hit a contrast target rather than inventing a fixed hex pair.
- Alternatives: A fixed alpha of 0.16, matching the tint used elsewhere on this page for open hidden lines (falls short of 4.5:1 against `mutedForeground`, confirmed by the new test failing at that value; 0.1 passes). Aligning the badge to a real gutter's rendered width as well as `codePaddingInline` (no current hidden-lines example has a gutter, since line permalinks are not built yet; noted inline as a known gap for that step).

## Inline callouts: a sibling of the line, sized against the visible block

- Date: 2026-09-25
- Step: 5.1
- Decision: `pluginCallouts()` inserts each bubble as a `div.scb-callout` (`role="note"`) directly before its target `.ec-line` inside `pre > code`, in `postprocessRenderedBlock`, and runs after hidden lines in the preset because that plugin rebuilds the code element's children. The arrow position is a `--scb-callout-mid` column in `ch`, counted from the line text with tabs to the next multiple of 8. The `pre` gets `container-type: inline-size` (only when it holds a callout), so the bubble can be at most `min(60ch, 90cqi)` wide and the callout row at most `100cqi`. When the target text is past the right edge of the visible block, the bubble start is clamped to leave at least 24ch, and the arrow to 24px from the right edge. Colours reuse the shared `popover…` tokens through a `codeblocksCallouts` group.
- Reason: SPEC 6.4 says 90% of the block, but the code element grows with the longest line, so a percentage of it could make the bubble wider than what the reader sees. The clamp keeps the note readable on a 360 px phone without horizontal scrolling to find it, which the mockup does not handle. A sibling element keeps line-state and highlight backgrounds off the bubble, as in the mockup.
- Alternatives: The bubble inside the line's `.code` element (the line's background and blur would cover it). No clamp, as in the mockup (on a phone the bubble sits half outside the block). Reading `tab-size` in the browser (needs a client module for a rare case).

## Annotations: anchor names at build time, a print list in the HTML

- Date: 2026-09-25
- Step: 5.2
- Decision: Each marker is a `button` with `popovertarget` and an inline `anchor-name`, and its popover (`popover="auto"`, `scb-float`) follows it inside the line's `.code` element with the matching `position-anchor`. So CSS anchor positioning works without JavaScript. The client module (`scb-annotations`) only calls `place()` on `toggle`, which is a no-op where `position-area` is supported. The block also gets an `ol.scb-annotation-list` after the `pre`, hidden on screen and shown in print, while markers and popovers are hidden in print. The marker's active style uses `:has(+ :popover-open)`, not a static `aria-expanded`, because browsers already expose the expanded state of a popover invoker. The popover uses the shared `popover…` tokens, with a slightly larger text size than the default.
- Reason: SPEC 6.5 asks for correct behaviour without JavaScript and SPEC 5 asks for a printed list. Build-time anchor names give real positioning in current browsers with no script. A static `aria-expanded="false"` would go stale without a script to update it.
- Alternatives: Anchor names set by the script only (the popover sits in the browser's default place without JavaScript even in browsers that support anchors). Moving popovers to `document.body` (loses the theme variables, ARCHITECTURE Q8). Adopting the mockup's page-surface colours for the popover (a second popover look next to callouts, and the shared tokens already have light values with checked contrast).

## Footnotes: numbered links, footnotes="static", one document listener

- Date: 2026-09-25
- Step: 5.3
- Decision: Each list item starts with its own number as a link (`a.scb-footnote-num`, "Footnote N, for line L") back to the badge, followed by the note text, instead of wrapping the whole note in a link as the mockup does. `footnotes="static"` turns the sticky list off for one block when the site sets `footnotes: { sticky: true }`; any other value warns. The client module adds one click listener on the document, which highlights the line and the item and clears it on any other click; it scrolls the other end to the centre of the window only when it is off screen. The list is part of the block frame (side and bottom borders, and the `pre` loses its bottom radius). Footnote colours are a `codeblocksFootnotes` group, with the mockup purple for dark and a darker purple for light, and a contrast test.
- Reason: Notes can hold links (SPEC section 4), and a link inside a link is invalid HTML. The spec gives a site-wide sticky default but no per-block way back, which a site with that default needs. Centring an off-screen target keeps it clear of a sticky list and the Starlight header.
- Alternatives: The whole note as a link (breaks for notes with links). `footnotes=false` as the opt-out (reads as turning the feature off, which it does not do). `scrollIntoView({ block: 'nearest' })` (can leave the line under the sticky list).

## Side-by-side annotations: a 600 px container query on a wrapper around the frame

- Date: 2026-09-25
- Step: 5.4
- Decision: With `annotations="side"`, `pluginAnnotations()` replaces the block's AST with `div.scb-side.not-content` (the container, with `data-scb-annotations`) > `div.scb-side-grid` > the frame and `ol.scb-annotation-notes`. Lines get `data-scb-anno` and an `aria-hidden` number; there are no popovers. `@container (min-width: 600px)` makes the grid (`1.65fr` and `minmax(190px, 1fr)`) and makes the notes sticky at `--sl-nav-height` plus `--sl-mobile-toc-height` plus 1rem. The client module links notes and lines on `mouseover` and `focusin` (notes have `tabindex="0"`), and adds `scb-side-static` when the column is taller than the space below the header. Any other `annotations` value warns and keeps popovers.
- Reason: SPEC 7.7 says 640 px, but Starlight's default content column is about 632 px wide at every desktop size, so 640 px would never show the columns on a default Starlight site. SPEC 5 says features must work in the default content width. 600 px is the closest value that works there. A wrapper keeps the notes inside `.expressive-code`, so they get the theme variables, and `not-content` keeps Starlight's Markdown list and spacing styles off them.
- Alternatives: 640 px as written (the columns never appear on the docs site). Breaking the block out of the content column (clashes with the table of contents). A CSS-only sticky check (CSS cannot compare the column height with the viewport).

## Smart shell copy: prompts leave the code before highlighting

- Date: 2026-09-25
- Step: 6.1
- Decision: In `preprocessCode`, `pluginShellCopy()` removes each prompt from the line text and adds it back as an unselectable `span.scb-shell-prompt` at the start of the rendered line. Output lines lose their syntax colours (the Shiki inline style annotations are deleted in `postprocessAnalyzedCode`) and use `codeblocks.mutedForeground`. The copy button keeps Expressive Code's icon; its `title`, which is also its accessible name, becomes "Copy commands". A block is a terminal when `frame="terminal"`, or when the frame is automatic and the language is in the frames plugin's `LanguageGroups.terminal`, imported from `@expressive-code/plugin-frames` (a new dependency, already installed by Expressive Code). The prompt colour is a `codeblocksShellCopy.promptForeground` setting, the mockup teal for dark and `#0f766e` for light.
- Reason: With the prompt out of the code, Shiki highlights the command as a command, and the copy text needs no prompt stripping. Importing the language list keeps the plugin's idea of a terminal the same as the frames plugin's. The mockup's text button would replace Expressive Code's copy button on every block, which is out of scope for one feature.
- Alternatives: Annotating the prompt in place (Shiki reads `$ uv` as a variable, and the copy text must strip prompts again). A copied list of terminal languages (drifts from Expressive Code). `instanceof InlineStyleAnnotation` (fails for `<Code>`, see ARCHITECTURE.md).

## Open in playground: a shared group of title bar controls

- Date: 2026-09-25
- Step: 6.2
- Decision: `addTitleBarControl()` in `core.ts` puts every title bar control in one `span.scb-tools` at the end of the header, 8px from the edge, with a 6px gap, as the mockup's `.tools`. In terminal frames the group is absolutely placed at the end, because the terminal header centres its title. The rule that gives a block with no title a minimal title bar moved from hidden lines to the shared styles and now keys on `.scb-tools`. The shared `scb-btn` style now uses the mockup's `.tool` values: the code foreground colour, a 14% foreground border, a 6% background (13% on hover) and 3px 8px padding. A playground link or form gets a `scb-sr-only` " (opens in a new tab)". The playground gets the text in the copy button's `data-code` (falling back to the code when a site turns the copy button off), so it sees the same text as the copy button, after shell copy and the other features. An unknown `playground` name warns and renders no button. A custom playground with a built-in name replaces the built-in one.
- Reason: Hidden lines, playgrounds and, later, the Run button and the code switcher all share the title bar, and the mockup puts them in one group. The old `scb-btn` had a border in `borderColor`, which is invisible on the dark theme, and muted text, where the mockup's controls have a visible border and full-colour text. Reading `data-code` means the playground needs no copy-text logic of its own.
- Alternatives: Each feature appends to the header on its own (controls stack without a gap and each needs its own `margin-inline-start: auto`). A build error for an unknown name (one typo in one page would stop the site build).

## Token links: same-tab links, only the first slash pair is literal

- Date: 2026-09-25
- Step: 6.3
- Decision: `[!link /text/ <url>]` renders `a.scb-link` around the first match, through an Expressive Code annotation that wraps the token spans, so the text keeps its syntax colours. The link opens in the same tab, with no `target`. The underline uses `codeblocksTokenLinks.underline`, the full accent colour, and hover adds a 12% accent background. The comment notation parser now reads only the first `/…/` of a directive as literal text; a later word that starts with `/` is a normal word. `codeblocks()` stores Astro's `base` in the registry, and a URL that starts with a single `/` gets it in front, unless it already starts with it. A preset-only site (no `codeblocks()`) leaves URLs as written.
- Reason: Starlight opens links in the same tab, and a new tab without a warning is a surprise for keyboard and screen reader users. The mockup's 70% accent underline falls under 3:1 on Starlight's light code background (`#f6f7f9`); the full accent passes on every background. Site-relative URLs such as `/reference/client/` start with a slash, which the parser would otherwise read as a second literal.
- Alternatives: `target="_blank"` as in the mockup. An escape for slashes in URLs (authors would need to write `\/reference\/`). Reading the base from Vite's `BASE_URL` (not available in the Expressive Code hooks).

## Fill-in placeholders: text replacement in templates, a separate script for the TS Playground

- Date: 2026-09-25
- Step: 6.4
- Decision: Each match becomes an `input.scb-placeholder` inside a copy of its syntax token's `span` (so it inherits the token colour through `color: inherit`), with `placeholder`, `aria-label` and `data-ph` set to the text, and a `ch` width. The figure gets `data-scb-placeholders="<storage>"`. The client module keeps the build-time copy text, playground URL and form field values as templates, and replaces each placeholder text in them with the reader's value (or the text, when the field is empty): as is for the copy text and form fields, and through `encodeURIComponent()` for URLs. The TS Playground URL is compressed, so a text replacement cannot work there: when a block has fields and the built-in TS Playground, its link gets `data-scb-playground`, which loads a second module (`scb-playground`, with lz-string, 1.9 kB gzipped) that rebuilds the URL from the copy text on a `scb-placeholders-change` event. Values are saved under one `scb-placeholders` key as JSON; a blocked or full storage falls back to memory. Client builds now bundle their dependencies (`deps.alwaysBundle` in `tsdown.config.ts`).
- Reason: A custom playground's `url` or `post` function runs at build time and cannot run in the browser, so the browser can only edit its output. Replacing text works for the common encodings (none and `encodeURIComponent()`), and the docs say so. Keeping lz-string out of the placeholder module means pages with fields but no TS Playground load 1 kB, not 3 kB.
- Alternatives: `field-sizing: content` for the width (not in Firefox). Serialising the playground functions to the browser (breaks closures and imports). Putting lz-string in the placeholder module (every page with fields pays for it).

## Line permalinks: an own gutter, line ids, a shared gutter width variable

- Date: 2026-09-25
- Step: 7.1
- Decision: `id="<id>"` adds a gutter element with `a.scb-permalink` links to `#<id>-L<n>` (numbers from `startLineNumber`, counting the lines readers see), puts `id` on each `.ec-line` and on the figure, and sets `--scb-gutter` (in `ch` of the code font, `max(2, digits) + 2.2`) on the figure. The hidden-lines marker and the callout bubble and arrow add `--scb-gutter` to their start offset; the marker divides it by its own font scale. Hidden lines keep a permalink id instead of their own. The gutter separator line of Expressive Code is turned off in these blocks (`--ec-gtrBrdCol: transparent`), as in the mockup. Line number colour is `gutterForeground` raised to 4.5:1, because the numbers are links. The target colour is `#ffcb8b` (mockup) and `#a15c00` on light themes. Without JavaScript, the links go to the line itself (lines have ids), which is better than the block only. The duplicate-id warning comes from a Sätteri `before` hook that reads every code node's fence line with Expressive Code's `MetaOptions`; the integration registers it by duck typing `markdown.processor.options.mdastPlugins`, without a dependency on `@astrojs/markdown-satteri`. `satteri`, `@types/mdast` and `@expressive-code/plugin-line-numbers` are dev dependencies for tests and types only.
- Reason: Expressive Code gives no per-document state in its hooks that survives dev re-renders (`positionInDocument.groupIndex` never resets), so the page-level check belongs in Markdown. A CSS variable keeps the three features in step without them reading each other's data.
- Alternatives: `:target` CSS for a no-JavaScript highlight (spec says without highlight, and it would fight the script). Tracking ids per file in the Expressive Code plugin (false warnings in dev).

## Code mentions: pairing in the browser, the plain-text check in Markdown

- Date: 2026-09-25
- Step: 7.2
- Decision: `[!mention <name>]` (one name; a line can carry several tags) sets `data-scb-mention` on the line and `data-scb-mentions` on the figure. The client module pairs each `a[href^="#mention:"]` with a block by document order: the next tagged block before the next heading, or else the last tagged block before the link. It sets `aria-describedby` on the link to the tagged lines, and injects the dotted-underline style for the links, because Expressive Code scopes its styles to the blocks. Selecting a link keeps the highlight while it has focus, and does not change the address. The Sätteri `before` hook checks the same rule on the mdast (sections split at every heading, tags found with a regular expression in the code) and replaces a link with no match by its children, with a build warning. The docs `Example` component now takes the live Markdown between its tags for examples that `<Code>` cannot render (prose, directives); `scripts/examples.test.mjs` checks that it matches the source pane. That pane drops `not-content`, so prose looks as it does on a page.
- Reason: Pairing in the browser also works for blocks from `<Code>` and for preset-only sites, which never pass through our Sätteri plugin. Only the plain-text fallback and the warning need the build, and they need the whole document.
- Alternatives: pairing only at build time and passing a block id through the fence line (breaks for `<Code>` blocks); a stylesheet through Starlight `customCss` for the link style (styles links on pages without the module, where they do nothing).

## Code switcher: one wrapper, one Expressive Code block for each variant

- Date: 2026-09-25
- Step: 7.3
- Decision: The Sätteri plugin turns `:::code-switcher{sync="…"}` into `div.scb-switcher[data-scb-code-switcher="<sync>"]` and adds `scbSwitcher="<URI-encoded JSON of index and labels>"` to each fence line. Labels come from `label`, read with Expressive Code's `MetaOptions`, or from the display name of the language in Shiki's `bundledLanguagesInfo` ("Python" for `py`). Anything but code blocks inside the directive fails the build. The Expressive Code plugin puts a native `select` (`scb-btn`, accessible name "Variant") in the title bar of each variant and sets `hidden` on the group of every variant after the first, so the page is correct without JavaScript; `@media (scripting: none)` hides the menu. The client module shows one variant, keeps focus on the menu of the new variant, and saves the label per sync key in `localStorage` (`scb-code-switcher:<key>`); a block without the saved label shows its first variant. `shiki` is now a direct dependency (it is already installed through Expressive Code, and phase 10 needs its language list too). The forced title bar of blocks with no title now draws the frame border on its top and sides, so it looks like one frame with the code; this also changes blocks with hidden lines or playground buttons and no title.
- Reason: Separate Expressive Code blocks keep each variant's own title, frame, copy text and features with no extra work. JSON in one attribute avoids quoting problems in the fence line.
- Alternatives: rendering every variant into one figure (a second renderer for titles and copy buttons). A hand-written map of language names (misses most languages).

## Token transitions: steps built from the rendered blocks, animation inside the new block

- Date: 2026-09-25
- Step: 8.1
- Decision: `<CodeSteps>` (from `starlight-codeblocks/components`, shipped as source in `src/components/`, so the package now publishes `src` next to `dist`) reads its blocks from `Astro.slots.render()`. `pluginTransitions()` adds `span.scb-steps-head > span.scb-steps-label` after the title for a `step="…"` attribute, and holds the styles. The component then adds, at build time, the numbered steps (`button.scb-steps-dot` with `aria-current="step"` and the name "Step N: label") and the Previous and Next buttons (`scb-btn`, in `.scb-tools`) to every title bar, keys the tokens with `@shikijs/magic-move/core` (each step synced to the one before, so tokens that never change keep one key), and writes them as `[key, text, style]` arrays in a JSON script. The client (`code-steps-client.ts`, about 2.7 kB gzipped with the renderer) moves the `scb-steps-current` class, and animates in a `div.scb-steps-anim` that replaces the new block's `code` element until the animation ends; the real block then shows again. Each token names its own colour (`color: var(--N)`), with N from a `codeblocksTransitions.themeIndex` style setting, because Expressive Code's token colour rule needs an unclassed span inside `.ec-line`. `@media (scripting: enabled)` hides every block but the current one, so the page does not jump when the script starts. Previous and Next always show their icon and their word (see "Token transitions: Previous, Next and a step counter under the block"). The step border is `#6b7894`, not the mockup `#5d6a85`, which is under 3:1 on the dark code background. A screen reader live region (Starlight's `sr-only`) announces the new step.
- Reason: Each step keeps its own Expressive Code block, with its title, copy text and every other feature, and the animation uses the same token colours as the static block. Build-time keys mean no Shiki and no diff library in the browser. At 360 px, the title, three steps and the two words overflow the title bar.
- Alternatives: One block rewritten in place by the renderer (loses line decorations and the copy text of each step). A Sätteri plugin that passes step numbers to Expressive Code (Sätteri does not see into MDX components reliably, and the component has the HTML anyway). Key pairs for every two steps (the data grows with the square of the steps). A wrapping title bar at narrow widths (the mockup keeps one row).

## Scrollycoding: build-time copies, a sticky copy from 600 px, focus kept on hover

- Date: 2026-09-25
- Step: 8.2
- Decision: `<Scrollycoding>` reads the one block and the `<Step>` elements from the rendered slot and fails the build for anything else, or for a range that is not valid (`focus` and `mark` take ranges without braces). For each step, it puts a copy of the block after the step text, with `scb-focus-out` on the lines outside the focus and Expressive Code's `mark` class on marked lines, so the narrow layout needs no JavaScript and uses the focus styles as they are. A step's focus replaces a `focus` attribute on the fence line. A last copy sits in a sticky column, in the state of the first step; the client changes its classes when a step crosses the middle 10% of the window (`IntersectionObserver`, as the mockup). The two columns (`1fr` and `1.45fr`, 22 px gap, as the mockup) apply at a content width of 600 px or more, only under `@media (scripting: enabled)`, so without JavaScript every width shows the narrow layout. Steps are `30vh` high in the wide layout, and inactive steps have 0.38 opacity. The sticky block's figure gets `scb-scrolly-frame`, and the focus plugin no longer clears the blur on hover for that figure; keyboard focus still clears it. `scrollycoding: false` leaves out the sticky copy and the data attribute.
- Reason: The same 600 px threshold as side-by-side annotations, because Starlight's content column is about 632 px (see "Side-by-side annotations"). The mockup keeps the blur under the pointer in its scrollycoding demo, because the pointer often rests on the block while the reader scrolls. Build-time copies keep each copy a real Expressive Code block with its own copy button.
- Alternatives: The mockup's 190 px steps inside a 460 px frame (the spec asks for page scrolling; 30vh keeps a similar ratio to the window). Moving one block under each step with JavaScript on narrow screens (no layout without JavaScript). A `focus` attribute passed back through Expressive Code (the component has only the rendered HTML).

## API links: lazy adapter setup, a fetch cache outside Astro's cache folder, card text on the link

- Date: 2026-09-25
- Step: 9.1
- Decision: `pluginApiLinks()` runs each adapter's `setup()` the first time a block in one of its languages renders, once per adapter object, and skips the adapter (with a warning) if `setup()` rejects. `AdapterContext` has `root`, `cacheDir` (Astro's, for data that other integrations keep there), `warn()` and `fetch(url)`. `fetch` keeps each body in `node_modules/.cache/starlight-codeblocks/<sha256 of the URL>`, written through a temporary file and a rename, and reads that file on every later call, in the same build or a later one. It never expires; deleting the folder fetches again. A failed request (network error, HTTP error, 20 s timeout) returns `null` with a build warning, caches nothing, and the names stay plain text: the build does not fail. `Resolution` has an extra optional `name`, the qualified name for the card when there is no signature (`from pathlib import Path` finds `Path`, the card shows `class pathlib.Path`). Each link carries its card text in `data-scb-api-head`, `-summary` and `-source`, and the same text in `aria-description`, so screen readers get it with or without JavaScript. The client module (1 kB gzipped) makes one `popover="manual"` card per block, inside the figure (ARCHITECTURE Q8), `aria-hidden`, shown after 150 ms of hover or at once on focus, hidden on Escape, blur or 200 ms after the pointer leaves both the link and the card. Readers can move the pointer onto the card (WCAG 1.4.13), unlike the mockup's `pointer-events: none`. Names on a line with a `[!link]` directive are not linked, which avoids a link inside a link. `javascript:` and other non-HTTP URLs from an index are dropped. The dotted underline is `#7f8aa0`/`#7d8696` (3:1 on both themes' code backgrounds; the mockup's 50% white is about 4:1 on dark).
- Reason: Lazy setup works the same in fenced blocks, in `<Code>` and in preset-only sites, and costs nothing on sites with no block in the language. The docs build (and many sites) clears `node_modules/.astro` to avoid stale content, which would throw the cache away on every build; `node_modules/.cache` is the usual place for tool caches and survives that. A fixed file per URL makes repeat builds and CI runs with a restored cache deterministic and offline.
- Alternatives: Setup in `astro:config:setup` (not available to preset-only sites or unit tests). A time-to-live on the cache (a build would then change without any change to the site). A build error on a failed fetch (a docs build would then depend on another site being up). A hidden card element for each link at build time (repeats the markup for every name).

## Python adapter: `stdlib`, `inventories` and `pydocs` options, links only through imports

- Date: 2026-09-25
- Step: 9.2
- Decision: `python({ stdlib = true, inventories = [], pydocs = [] })` from `starlight-codeblocks/adapters/python`. `stdlib: false` leaves out `https://docs.python.org/3/objects.inv`; `inventories` adds more (a URL, or `{ url, base }` when relative links do not start from the folder of the URL). `pydocs: [{ package, base = 'api/<package>', dump? }]` reads the Griffe dump (explicit path, or the newest `starlight-pydocs/<package>-*/dump.json` in Astro's cache folder, ARCHITECTURE Q9) and its names win over the inventories. The adapter tokenises the block (strings, f-strings and comments dropped), reads `import a.b [as c]` and `from a import b [as c]` (with brackets and several lines), and links: the module and imported names in the import statements (not the `as` names), and each chain whose first name an import binds, as far as the index knows it (`json.loads`, one link). After a call to a class (`Path(…)`), the next attribute links to the class's member (`read_text`); no other type is guessed. A name that the block binds again (`=`, `:=`, `def`, `class`, `for`, `as`, function parameters, `global`) never links. Built-in names such as `print` are not linked, as in the mockup. The card source is `<Project> <Version> documentation` from the inventory header ("Python 3.14 documentation") and `<package> API reference` for pydocs. Pydocs signatures are built from the dump: `myproject.summarise(data: dict, *, top: int = 5) -> str` for functions, `Report.render(…)` for methods (without `self`), `class myproject.report.Report(title: str)` from `__init__`; the summary is the first sentence of the docstring. A re-export (`from myproject import Report`, a Griffe alias) links to the object's own page. Unit tests get a small copy of the standard library inventory from `test/setup.ts`, and `test/global-setup.ts` clears the fetch cache before each run. On the docs site, the Python examples of other feature pages that import standard library modules now have `apiLinks=false`, following the one-feature-per-example rule (the same way `wordDiff=false` is used).
- Reason: A wrong link is worse than none, so only names that an import binds, and that the block does not bind again, can link. `stdlib` as a switch lets a site add inventories without restating the default one.
- Alternatives: `inventories` replacing the default list (a site adding NumPy would lose the standard library by accident). Linking built-ins (certain, but not in the mockup, and very frequent). Following assignments (`p = Path(…)`, then `p.read_text`), which needs scope analysis to be certain. Finding starlight-pydocs packages without the `pydocs` option (the base of their pages is not in the dump, so links could be wrong).

## Nextflow adapter: bundled reference on docs.seqera.io, channels only when certain, `modules` may return card text

- Date: 2026-09-25
- Step: 9.3
- Decision: `nextflow({ modules })` from `starlight-codeblocks/adapters/nextflow`, for `nextflow` and `nf` blocks, needs no network. The bundled map (`src/adapters/nextflow-reference.ts`) has the 10 channel factories and 47 operators of the current reference, with signatures for factories and a one-sentence summary plus the return type for operators. URLs point at `docs.seqera.io/nextflow/reference/…`, where `www.nextflow.io/docs/latest/…` now redirects; every anchor was checked against the live pages. `channel.of` (or `Channel.of`) is one link, or just `of` when a line break splits it. Operators link in a chain that starts at a factory call, or at a variable whose every assignment in the block is a `channel.…` expression, or that `set { x }`/`tap { x }` names; the chain stops at the first name that is not an operator. `include { A; B as C } from '…'` links `A` and `B`, and later uses of `A` and `C`, through `modules({ name, path })`, which returns a URL, an object with `href` and optional `kind`, `signature`, `summary` and `source`, or `undefined` for plain text. Without `modules`, included names stay plain. The default card source for modules is "Module reference". The default `apiLinks.adapters` is `[python(), nextflow()]`.
- Reason: The spec asks for certainty, and an operator name such as `collect` or `first` is also a Groovy list method, so only chains known to hold a channel link. Card text from `modules` lets a pipeline show a process's inputs and outputs, as in the mockup, without the adapter reading module files.
- Alternatives: Linking every `.map`/`.collect` (wrong on lists). Keeping `www.nextflow.io` URLs (one redirect for every link). Reading `main.nf` of each module for the card (needs file access that the adapter interface does not give, and the path may be remote).

## API links docs: the site's own adapter, nf-core module links, a card sized to its text

- Date: 2026-09-26
- Step: 9.4
- Decision: The docs site uses `python()`, `nextflow({ modules })` with nf-core module pages (`https://nf-co.re/modules/<name>`, kind `process`) and its own adapter, `docs/src/adapters/codeblocks-api.mjs`, which links names that a JavaScript block imports from starlight-codeblocks to their reference pages. The "Write an API link adapter" page shows that file through a `?raw` import, so the guide and the running adapter cannot drift. Config snippets that import from starlight-codeblocks (Getting started, the two new pages) now have links; feature examples on other pages do not. The card keeps `width: max-content` up to the shared popover width (340 px) and starts at the link, like annotation popovers, where the mockup has a fixed 360 px card centred on the link.
- Reason: DOCS-SITE.md asks for an extend page example that the site itself uses. A card sized to its text has no empty space for short cards such as `module json`, and one positioning rule for every float keeps `place()` simple.
- Alternatives: A made-up adapter shown only as text (not tested by the build). A fixed-width, centred card (a second positioning rule).

## Hidden lines: the dashed rule returns, full width and behind the badge

- Date: 2026-09-26
- Step: 4.6 follow-up (user feedback)
- Decision: `.scb-hidden-marker` is a full-width button again (as in the original c2b8e62 marker, restored on top of the boxed-badge version from the first follow-up). A `::before` pseudo-element draws the dashed rule, absolutely positioned and vertically centred, inset from the code's own left and right padding (plus `--scb-gutter` on the left, so it starts where the code text does, never under a permalink's line numbers). The rule's colour is `codeblocks.mutedForeground` at 35% alpha through `color-mix()`, fainter than the original opaque 1px dashed line. The pill badge moved onto the button's inner `<span>` (`position: relative; z-index: 1`), which paints over the rule where the two overlap, so the line reads as passing behind the badge. The button's own background stays `none`, so the whole row is clickable, not only the badge.
- Reason: The user compared the boxed-badge version against the mockup and asked for the dashed line back, at a lower opacity, centred behind the badge, with the whole row still clickable. A z-index'd `position: relative` span over a `position: absolute` rule is the standard "line behind a badge" pattern and needs no extra markup node. `docs/e2e/line-permalinks.test.ts`'s alignment check moved from the button's own bounding box to the span's, since the button itself now starts at the row's left edge rather than at the code's text column.
- Alternatives: A full-width line only after the badge, as in the mockup's own CSS (the user's own description said "behind", not "after", the badge). A separate line element instead of `::before` (an extra DOM node for a decoration the CSS can already draw).

## Inline highlighting: its own stylesheet from the site engine's style variants, Starlight's theme switch

- Date: 2026-09-26
- Step: 10.1
- Decision: The core Expressive Code plugin stores the site engine's `styleVariants` in the registry when its `baseStyles` resolver runs, and `codeblocks()` stores the site's Expressive Code options (Starlight's `expressiveCode` object merged with `ec.config.mjs`). `codeblocks()` adds `virtual:starlight-codeblocks/inline-code.css` to Starlight's `customCss`; a Vite plugin builds it on first load from those variants: `codeBackground` and `codeForeground` of each theme, and the token rules of Expressive Code (`var(--N)`, `--Nbg`, `--Nfs`, `--Nfw`, `--Ntd`). Theme switching copies Expressive Code's own logic: the base theme on plain `code.scb-inline`, the `prefers-color-scheme` query under `:root:not(<base selector>)` when `useDarkModeMediaQuery` (default: one dark and one light theme), and `<themeCssRoot><selector>` for each other theme. The selector is the site's `themeCssSelector` if it sets one, otherwise Starlight's (`[data-theme='<type>']` for the base and first opposite theme, unless `useStarlightDarkModeSwitch: false`). The inline engine (`expressive-code`, now a runtime dependency) uses the captured themes with `minSyntaxHighlightingColorContrast: 0`, because the site engine already corrected them against its own backgrounds, and the site's `shiki` options, so custom languages work. A language is unknown when that engine logs a warning during the render; renders run one at a time so that a warning belongs to its render. An unknown language leaves the inline code as it was, with the suffix removed and a build warning.
- Reason: Expressive Code gives no hook with the engine config at start-up, and its own theme CSS applies the other theme's variables only inside `.expressive-code` (ARCHITECTURE Q8). A virtual module in `customCss` is the one way to put CSS on pages without code blocks that still sees the site's themes, because Vite loads it after the renderer exists. Checking the render's warning, not a list of bundled languages, matches exactly what code blocks accept, including `langAlias` and custom `langs`.
- Alternatives: A `<style>` element in each page that uses the feature (duplicate CSS, and `<style>` in the body). Running the engine's own `getThemeStyles()` and renaming the selectors (every `--ec-*` variable, for two colours). Checking `bundledLanguages` (misses custom languages).

## Docs examples for inline highlighting show the `.md` form

- Date: 2026-09-26
- Step: 10.1
- Decision: The "You write" pane shows `` `code`{:js} ``, and the live copy in the MDX page uses `` `code`\{:js} ``. `scripts/examples.test.mjs` treats `` `\{: `` in the live copy as `` `{: `` when it compares the two. The feature page has a caution about the MDX backslash.
- Reason: The `.md` form is the syntax. MDX fails the build without the backslash, so the live copy must have it.
- Alternatives: Show the MDX form in the source pane (wrong for `.md` files, which is where most prose lives).

## Runtime modules: one chunk each, at a fixed path, loaded on the first click

- Date: 2026-09-26
- Step: 11.1
- Decision: The integration's Vite plugin emits each entry of `runnable.runtimes` as its own chunk in Astro's client build, at `<build.assets>/scb-runtime-<language>.js` with `preserveSignature: 'strict'`. Paths that start with `.` resolve from the project root; others (package paths) resolve like any import. In dev, the same URL resolves to the module, so Vite serves it. A `runnable` block carries the URL in `data-scb-runnable`, the language's display name (from Shiki's language list, which also maps aliases such as `py` to `python`) and the timeout. The `scb-runnable` client module (under 1 kB) loads on pages with such a block and imports the runtime only when a reader selects Run. Without `codeblocks()`, nothing bundles the modules, so the values are used as URLs as written.
- Reason: Runtime modules come from the site (TypeScript included) and from the package, so Vite has to bundle them, but the client module is prebuilt and cannot import through Vite. Code blocks render in the prerender build, before the client build, so the URL must be known in advance: the file name has no hash. The browser can cache an old runtime for as long as the host allows; runtimes change rarely.
- Alternatives: A hashed file name read back in `generateBundle` (the HTML is already rendered by then). `injectScript('page')` with a map of `import()` calls (a script on every page, against SPEC 2).

## Run button and output panel

- Date: 2026-09-26
- Step: 11.1
- Decision: While a run is in progress, the Run button has `aria-disabled="true"` and ignores clicks, instead of `disabled`, so the keyboard focus stays on it. There is no Stop button; the timeout stops runs (SPEC names only the timeout). The timeout covers the run only, not the runtime download, which has no limit. The client races `run()` against the abort, so the button comes back even if a runtime ignores the signal; after a timeout the next run calls `load()` again and shows the loading message. The output panel is an empty `aria-live="polite"` element in the static HTML, with no box while it is empty, so that it is in the accessibility tree before its first update. It shows "Output", then standard output, then standard error. Standard error has a bar at its start and a hidden "Error:" prefix as well as its colour. The panel also shows "Running…" during a run and "The code ran with no output." after a silent run.
- Reason: SPEC 5 and AGENTS.md: keyboard focus must not be lost, and colour must not carry meaning alone. A live region that appears together with its content is often not announced.
- Alternatives: A Stop button (not in the spec or the mockup). A `hidden` panel (the live region then misses its first update).

## The docs site's JavaScript runtime doubles as the test runtime

- Date: 2026-09-26
- Step: 11.1
- Decision: `docs/src/runtimes/javascript.ts` runs JavaScript in a new web worker for each run, with `console.log` and `console.error` as the output. The feature page and the "Add a runtime" guide use it, and the Playwright tests for the button, the panel and the timeout run against it, with no network.
- Reason: A real, small runtime is the best example for the guide, and it makes the interaction tests fast and deterministic. Only the Pyodide tests need the network.

## Pyodide runtime: a factory for the CDN URL, a blob worker, a fresh namespace for each run

- Date: 2026-09-26
- Step: 11.2
- Decision: `starlight-codeblocks/runtimes/pyodide` exports `pyodide({ url })` and a default `pyodide()`. The default URL is `https://cdn.jsdelivr.net/pyodide/v314.0.7/full/` (the current `pyodide` release on npm). A site that wants another URL writes a one-line module, `export default pyodide({ url })`, and maps `python` to it. The worker is a module worker from a `blob:` URL, so the package ships one file and needs no bundler support for workers. It imports `pyodide.mjs` from the URL on the first `load()`. Runs wait in a queue in the worker, because standard output and standard error belong to the whole interpreter. Each run gets new globals, installs the packages that its imports name (`loadPackagesFromImports`), and drops Pyodide's own frames from a traceback. Stopping a run ends the worker, because Python cannot be interrupted without cross-origin isolation; the next `load()` starts a new one. With `codeblocks()`, `python` maps to this runtime unless the site maps it to another module.
- Reason: SPEC 8.2 fixes the interface to `load()` and `run()`, so the URL cannot be a per-call option; a factory keeps the interface and lets sites change the URL. GitHub Pages and most hosts do not send the cross-origin isolation headers that `SharedArrayBuffer` interrupts need.
- Alternatives: A `runnable.pyodideUrl` option (an option the spec does not name). `new Worker(new URL('./worker.js', import.meta.url))` (depends on the site bundler handling the pattern inside a prebuilt package). A shared namespace between runs (one block's names would leak into the next).

## Headings that components write reach the table of contents through route middleware

- Date: 2026-09-26
- Step: 3.5 (added in 066d1b5, extended in 12.1)
- Decision: `docs/src/route-data.ts` is a Starlight route middleware. It adds the headings that the reference components write (`Directives.astro`, `Attributes.astro`, `StyleSettings.astro`) to the table of contents of their page. The heading lists come from `componentHeadings` in `docs/src/components/reference.ts`, the same data that the components render.
- Reason: Starlight builds the table of contents from the Markdown headings only, so headings in a component's output are missing from it.
- Alternatives: Headings written by hand in the `.mdx` file (they drift from the source).

## Directive examples live in the package

- Date: 2026-09-26
- Step: 3.5 (added in 066d1b5)
- Decision: Each directive's description, arguments, example and feature page are in `DirectiveSpec.docs`, next to the directive in its plugin. The directives reference page renders them as sections with side-by-side examples. `test/directives-docs.test.ts` fails if a directive has no docs, or if its example does not render cleanly.
- Reason: The reference cannot drift from the directives that the plugins declare. The user found a wide table hard to read, so each directive is a section with an example.

## Attributes and style settings reference data in src/reference.ts

- Date: 2026-09-26
- Step: 12.1
- Decision: `packages/starlight-codeblocks/src/reference.ts` holds the docs for every attribute (`attributesReference`) and every style setting (`styleSettingsReference`). No entry point imports it, so it does not ship in the bundles. The attributes page renders it as sections with side-by-side examples, the same as the directives page. The style settings page renders one table per group, with the defaults read from each plugin's `PluginStyleSettings`, so values cannot drift; a computed default shows the `derived` text instead. `test/reference.test.ts` fails if the source reads an attribute (`metaOptions.get…('x')`, `list('x')`, `resolveRange(ctx, 'x')`) that is not in the reference, if an example does not render cleanly or does not change the output, if a style setting or group is missing or extra, or if `derived` does not match a computed default. It also checks that the Expressive Code plugins page names every `plugin…` export. Line-state settings use `<state>` keys, one entry for all states.
- Reason: DOCS-SITE.md asks for reference data from the source or one shared file. One file is simpler than a docs field on every plugin, and the attribute `label` is read by the Sätteri plugin, not by an Expressive Code plugin. Computed defaults (functions of other settings) have no fixed value to print.
- Alternatives: Resolve the defaults through an Expressive Code engine with the site's themes (the site engine's style variants are not reliably ready when the page renders, and Starlight's themes are not exported). A table with dark and light columns (too wide with descriptions).

## Code switcher e2e tests wait for the client module

- Date: 2026-09-26
- Step: 12.1
- Decision: The code switcher tests wait until every switcher has `data-scb-ready` before they select a variant, and poll the clipboard after a copy.
- Reason: The copy test failed once under load. A `change` event before the module starts is lost, and the clipboard write is asynchronous. 1,050 repeated runs pass.

## Accessibility fixes after the docs review

- Date: 2026-09-26
- Step: 12.1 follow-up
- Decision: Word-level diff underlines added words and puts a line through removed words (in the code foreground colour, `codeForeground`, so that a change across several tokens has one line in one colour; each span sits inside its token, so `currentColor` would be the token's colour), and gives each changed span the ARIA `insertion` or `deletion` role. Colourised brackets now also outline the pair at the caret, from one document `selectionchange` listener, which supersedes "Caret-based matching is not built" in the colourised brackets entry. The faded text of focus, code mentions and scrollycoding stays below 4.5:1 while faded; the accessibility page now calls it an exception to WCAG 1.4.3 and names the style settings that turn the fade off.
- Reason: WCAG 1.4.1: the tint was the only mark of a changed word. The bracket outline was pointer-only; caret browsing is the only keyboard path to a character that cannot take focus, and it costs a few lines. De-emphasis is the point of the three fading features, so the page states the exception plainly instead of claiming conformance.
- Alternatives: `<ins>`/`<del>` elements (Expressive Code's text markers style them as inline markers inside code). Screen-reader-only "changed" text (it would appear in a manual copy). Making every bracket focusable (dozens of tab stops per block).

## Logo and favicon

- Date: 2026-09-26
- Step: 12 (user request)
- Decision: One SVG, a terminal window (indigo frame, three title bar dots, dark body) with a yellow four-pointed star inside, in `docs/src/assets/logo.svg` (Starlight `logo`), `docs/public/favicon.svg` (Starlight `favicon`) and `.github/assets/logo.svg` (for the README). Fixed colours, no light and dark variants. `docs/public/apple-touch-icon.png` (180 px, logo on the body colour) through `head`. No share card image, because the site has no og:image set-up yet.
- Reason: The window carries its own background, so it reads on white and on the dark Starlight background without `prefers-color-scheme` rules; checked at 16, 32, 180 and 512 px on both. At 16 px the dots merge into a light title bar and the star stays clear.
- Alternatives: `currentColor` line art (the star loses contrast on a stroke-only window at 16 px). Separate light and dark logos (the same file already works on both).

## README media

- Date: 2026-09-26
- Step: 12.3
- Decision: `scripts/readme-media.mjs` (`pnpm readme:media [slug...]`) opens each feature page of the built docs site in Playwright (dark theme, device scale factor 2) and crops to the "Readers see" pane of the first example. Still features are palette PNGs. Interactive features are recorded as a sequence of clipped screenshots (about 25 per second) with a drawn pointer, and joined into an animated WebP with sharp, with identical frames merged. A dry run first measures how far popovers and expanded blocks reach, so each recording has one fixed clip; the recording then runs in a new browser context, because some features keep state in storage. `sharp` and `@playwright/test` are root dev dependencies, at the versions already in the lockfile. The package README is a committed copy of the root README, checked by a test. Images use absolute `raw.githubusercontent.com` URLs, so they also show on npm.
- Reason: GitHub does not play `<video>` from repository files, and animated WebP plays on GitHub and npm. The local ffmpeg has no WebP encoder, and Chrome's screencast frames are at 1x only, so neither gives high-resolution animation; clipped screenshots at 2x do. A committed copy is simpler than a copy step in the build, and `pnpm pack` needs no build hook.
- Alternatives: Playwright `recordVideo` and ffmpeg to GIF (1x, 256 colours, larger files). APNG (lossless, several MB per animation). A symlink for the package README (npm does not follow it reliably).

## Manual selection of hidden lines

- Date: 2026-09-26
- Step: 12.5
- Decision: The hidden-line marker has `user-select: none`, so a manual selection never picks up "N hidden lines". A manual selection still leaves out the hidden lines that are closed. The docs say so: the copy button always includes hidden lines, and a manual selection includes only the open ones.
- Reason: SPEC 5 says a manual copy must not contain decorations, and the marker text is one; the other decorations (line-state labels, prompts, badges) use the same rule. SPEC 5 asks for the same text as the copy button only "where the browser allows it", and a browser cannot select an element with `display: none`.
- Alternatives: A `copy` event handler that rewrites the clipboard to add the closed lines (more client code, and the pasted text would differ from what the reader selected).

## Options as sections

- Date: 2026-09-26
- Step: 12.5
- Decision: The options reference and the Options section of each feature page show one section per option (heading, description, type and default), from `<Options />`, which reads `optionsReference` in the package, in the same `ReferenceEntry` layout as the attributes and directives pages. `optionsReference` now has the `page` of each feature and, where it matters, `off`: what stays behind when the option is `false`. A feature page shows its options only if the feature has settings. The options of the built-in adapters are docs data in `docs/src/components/reference.ts`, because the adapters have only TypeScript types. The route middleware adds the headings to the table of contents. Inline code in table cells can break anywhere, and the comparison table of the annotation styles has three columns, so no table is wider than a 360 px screen. A Playwright test checks every page of the sitemap for horizontal overflow and wide tables.
- Reason: Four-column tables overflowed on phones and on the options page at desktop width. One source for the option data keeps the feature pages and the reference in step.

## Deterministic ids, and English UI strings

- Date: 2026-09-26
- Step: 12.5
- Decision: Annotations, footnotes and hidden lines build their element ids from one id per block: the first 8 hex characters of a SHA-1 of the source file path, the meta string and the code, plus a count when the same engine renders an identical block again. The footnote label "for line N" counts from `startLineNumber`. The interface strings (such as "Footnote 1, for line 2", "Show 3 hidden lines", "Copy") stay in English, and there is no option to translate them.
- Reason: Random ids changed the HTML on every build, so builds were not reproducible and every deploy changed every page. The hash keeps ids stable when unrelated blocks change; the count keeps two identical blocks on a page apart. The spec does not ask for translated interface strings, so translation is out of scope for this release.
- Alternatives: A global counter (ids change when a block above is added, and depend on the order in which Astro renders pages). Starlight's i18n strings (a later release can add them).

## Ids in Scrollycoding copies

- Date: 2026-09-26
- Step: 12.5
- Decision: `<Scrollycoding>` adds a suffix to every id in each copy of the block (`-s1`, `-s2`, … for the step copies and `-sticky` for the sticky copy), and rewrites `aria-controls`, `aria-describedby`, `aria-labelledby`, `popovertarget`, `#` links and CSS anchor names in the same copy to match. A line permalink id `<id>-L<n>` becomes `<id>-<suffix>-L<n>`, so the permalinks script still finds the lines of the block it belongs to. A link to `#<id>-L<n>` from outside the component does not select a line.
- Reason: Every copy had the same ids, so a hidden-lines marker or an annotation in the sticky copy opened the lines or the popover of a step copy that was not on screen.
- Alternatives: Keep the original ids on one copy (which copy a reader sees depends on the width of the page, so no single copy is right).

## CodeSteps with transitions off, and the narrow label rule

- Date: 2026-09-26
- Step: 12.5
- Decision: The Expressive Code plugin that renders the `step="…"` label is always registered, so with `transitions: false` each step still shows its label after the title. `<CodeSteps>` renders its `<script>` only when transitions are on, so the page then loads no magic-move code. The magic-move stylesheet is imported in the component frontmatter, so it lands only on pages whose modules import the components (about 1 kB, inert with the feature off). The label hides when the steps are narrower than 640 px (a container query, as for the other size rules of the steps), and only in a title bar that has the stepper.
- Reason: SPEC 7.5 says that without the interactive steps each step shows its label, and AGENTS.md says pages must not load client code for features they do not use. Imported in the `<script>`, the stylesheet went into the CSS of every page. Expressive Code scopes base styles inside `.expressive-code`, so the rule cannot test the `[data-scb-steps]` wrapper outside the block; `:has(> .scb-steps-stepper)` tests the title bar itself.
- Alternatives: A media query on the window (wrong in narrow columns, such as a side-by-side layout). Copying the magic-move rules into the component style (a copy of a dependency's CSS to keep in step).

## Tab width in visible whitespace

- Date: 2026-09-26
- Step: 12.5
- Decision: A tab keeps its natural width, to the next tab stop that `tab-size` sets, and its arrow sits at the start of that width, as in the mockup. The fixed `4ch` width is gone.
- Reason: A fixed width made a tab in the middle of a line under `whitespace="all"` stop short of the next tab stop, so the columns after it moved, and it ignored the site's `tab-size`. SPEC 6.10 says the arrow marks the tab's width, and the arrow at the start shows where the tab begins.
- Alternatives: Stretch the arrow across the tab (a long arrow reads as a symbol in the code, not as whitespace).

## Manual copy of shell output and fields

- Date: 2026-09-26
- Step: 12.5
- Decision: Output lines in a shell block have `user-select: none`, so a manual selection gives the commands only, as the copy button does. On a block with fill-in fields, a `copy` event handler (in the placeholders module, which such pages already load) replaces the clipboard text when the selection is inside the block's code: one line for each selected line, each field as its value or its placeholder text, and nothing that is not visible or not selectable. A selection that goes past the block keeps the browser's own text.
- Reason: SPEC 5 asks for the same text as the copy button where the browser allows it. The browser's own copy put line breaks around each field and left out its value. Building the text from the live DOM keeps partial selections partial, where copying the button text would copy the whole block.
- Alternatives: Write the copy button text for any selection in the block (wrong for a selection of one line). Record both as browser limits (the fix is small).

## Code text on plugin tints

- Date: 2026-09-26
- Step: 12.5
- Decision: On lines whose tint is known at build time (line states, word-level diff words, footnote lines, side-by-side annotated lines, mention lines), the plugin corrects each syntax colour to `minSyntaxHighlightingColorContrast` on the tint, in `postprocessAnnotations`, the same way Expressive Code corrects its own marked lines (`ensureTextContrast` in `core.ts`). A site that sets that option to `0` opts out, as it does for Expressive Code. Tints that any line or token can get (permalink target, API and token link hover) cannot be corrected ahead of time, so their alpha is lower instead: target 0.08 dark and 0.12 light, link hover 0.1 dark. Word-diff tints drop to the mockup's 0.36 (ins) and 0.4 (del) in dark themes and 0.3 in light themes; the underline and the line-through carry the meaning, so the old 3:1 tint check is replaced by a check on the decoration. Inline code in the footnote list uses the code foreground, and the placeholder hint text has full opacity. `test/tints.test.ts` renders blocks with Starlight's default themes and Expressive Code's defaults and checks every text colour on every tint at 4.5:1.
- Reason: The a11y review measured 2.2:1 for text on word-diff words and 4.0 to 4.5:1 on some line states. The mockup's tint strengths fail 4.5:1 with fixed colours; correcting the text keeps the design and works for any theme.
- Alternatives: Lower every alpha until all theme colours pass (tints of 0.08 are hard to see); force one text colour on tints (loses syntax colours).

## Focus rings and reduced motion beyond the plugin's own controls

- Date: 2026-09-26
- Step: 12.5
- Decision: The plugin's CSS sets the outline colour of `pre:focus-visible` (Expressive Code's scrollable code area) and of the focus code area to `codeblocks.focusRing`, and turns off the copy button transition under reduced motion. Both apply to every Expressive Code block on a site with the plugin.
- Reason: Expressive Code's focus border measured 2.5:1 (light) and 1.1:1 (dark) on the code. The copy button kept a 0.2 s transition under reduced motion. Both are cheap to fix in the plugin's scoped CSS.
- Alternatives: Leave them upstream. Still upstream: the `pre` elements with `role="region"` have no label, so axe reports `landmark-unique` on pages with more than one scrollable block. A label per block would still repeat for untitled blocks.

## Accessible name of a block with title bar controls

- Date: 2026-09-26
- Step: 12.5
- Decision: When the plugin adds controls to a title bar (`addTitleBarControl`, and the step controls of `<CodeSteps>`), the figure gets an `aria-label` from the title bar text without its controls, such as the title or "Terminal window", or "Code block" when there is no text.
- Reason: The figure takes its name from the whole `figcaption`, so the names read "summary.py Hide 5 lines" or "Run again". Moving the controls out of the `figcaption` breaks the title bar layout.
- Alternatives: `aria-labelledby` on the title (needs ids, and gives no name for untitled blocks).

## Hidden lines toggle state

- Date: 2026-09-26
- Step: 12.5
- Decision: The title bar button of hidden lines has a label that changes (**Show N hidden lines**, **Hide N lines**) and no `aria-pressed`. Its state comes from the markers.
- Reason: A pressed state and a changing label together announce a contradiction ("Hide 5 lines, pressed"). The changing label matches the markers and the mockup.
- Alternatives: A fixed label with `aria-pressed` (differs from the mockup).

## Footnotes for keyboard and screen reader users

- Date: 2026-09-26
- Step: 12.5
- Decision: Each badge has `aria-describedby` on its note text. Activating a badge moves focus to its list item (`tabindex="-1"`), and activating the number moves focus back to the badge. A focused control in a line that falls under the sticky list scrolls up above it (a `focusin` handler). The number links are at least 24 by 24 px.
- Reason: The script cancels the link navigation to keep the hash, so focus stayed on the badge and screen readers heard nothing. Browsers do not scroll a focused element that is in the viewport but under a sticky element (WCAG 2.4.11).
- Alternatives: `scroll-margin` from a CSS variable (browsers do not use it when the element is already in the viewport).

## Side-by-side notes and forced colours

- Date: 2026-09-26
- Step: 12.5
- Decision: The notes stay focusable list items, because SPEC 7.7 asks that focus on a note highlights its line, and now show the plugin's focus ring. Annotation markers have a transparent 1 px border and the current step of token transitions uses `Highlight` in forced colours mode.
- Reason: The a11y review found `outline: none` on the notes, and markers and the current step that looked the same as the rest in forced colours.
- Alternatives: Make the notes buttons (they do nothing on activation).

## Layout details from the visual review

- Date: 2026-09-26
- Step: 12.5
- Decision: The side-by-side grid uses `minmax(0, auto) minmax(12rem, 1fr)`, so the code column takes its natural width and the notes the rest, and the docs example has shorter lines, so it fits at every desktop width. A block with diff lines adds 1ch to the code padding, which puts a gap between the + and - markers and the code. Plugin buttons in the title bar use the code font at 0.75rem, as in the mockup. A callout knows the length of its text (`--scb-callout-len`), so a short bubble near the right edge moves left instead of wrapping. The dashed rule of a hidden-lines marker on the first line stops before the copy button.
- Reason: Findings of the visual review against the mockup.
- Alternatives: None worth the extra code.

## Feature-off attributes in docs examples

- Date: 2026-09-26
- Step: 12.5
- Decision: `<Example>` takes `hiddenAttributes`, which it adds to the fence line of each rendered block but not to the source pane. Examples use it for `apiLinks=false` and `wordDiff=false`, which only keep another feature out of the example. `scripts/examples.test.mjs` checks that live Markdown includes them and that no source pane shows them, except on the API auto-linking page, where the attribute is the subject.
- Reason: The attributes confused readers of the "You write" pane: they are not needed to use the feature on the page.
- Alternatives: Different example code for each case (not always possible for API links in Python).

## Print

- Date: 2026-09-26
- Step: 12.5
- Decision: Controls that do not print (`scb-no-print`): hidden-lines markers and title bar button, playground links and the form button, the code switcher menu, the numbered steps and the Previous and Next buttons of token transitions, and the expandable fade. A fill-in field prints as plain text: its value, or its placeholder text if the reader typed nothing.
- Reason: SPEC 5 Print. A field with a border on paper looks like a form to fill in; its value is what the reader needs.
- Alternatives: Hide the fields in print (loses the code).

## Port of the end-to-end tests

- Date: 2026-09-26
- Step: 12.5
- Decision: `docs/playwright.config.ts` reads the preview port from `SCB_E2E_PORT`, with 4329 as the default.
- Reason: Two agents or two checkouts can run the tests at the same time.
- Alternatives: None.

## Tints that show only when a line is active

- Date: 2026-09-26
- Step: 12.5
- Decision: The tints of a selected footnote line, an open annotation's line and a mentioned line use the accent at 10% opacity in dark themes and 12% in light themes, like the link hover tints, and the plugin no longer adjusts the syntax colours of those lines. Annotations get a `lineBackground` style setting for its tint. Syntax colours are adjusted only under tints that are always visible: line states and word diff.
- Reason: The adjustment ran at build time, so it changed the colours of these lines when they were not active too, and one token showed in two colours in a block. The lighter tints keep every syntax colour of Starlight's and Expressive Code's default themes at 4.5:1.
- Alternatives: Adjusted colours only in the active state, as CSS variables for each token (a lot of extra markup for a small gain).

## Print of focus, scrollycoding and token transitions

- Date: 2026-09-26
- Step: 12.5
- Decision: In print, lines outside the focus are sharp at 60% opacity. Scrollycoding prints its narrow layout: each step's text at full opacity, followed by its own copy of the block with that step's focus. Token transitions print every step, each with its title bar and step label. The wide layouts apply only under `@media screen`.
- Reason: Blur and the 48% opacity make code hard to read on paper, and a sticky column or a single visible step loses content. A light fade still shows which lines each step is about.
- Alternatives: No fade in print (loses the focus). Print only the last step of token transitions (loses how the code grew).

## Markdown routes and llms.txt on the docs site

- Date: 2026-09-26
- Step: after the plan (docs site)
- Decision: The docs site serves a Markdown version of each page at `<page>.md` (`index.md` for the home page), plus `llms.txt` and `llms-full.txt`, from its own Astro endpoints. `docs/src/markdown.ts` turns the MDX source into Markdown: imports and exports go, `<Example>` becomes the Markdown source that it shows (in a longer fence, so the fence line with its attributes stays), `<Code>` with a `?raw` import becomes a code block, the reference components become Markdown headings, lists and tables from the same data, tab labels and aside types become bold labels, and internal links become absolute. Any other component fails the build. `llms.txt` lists every page in sidebar order with its `.md` URL and description; the sidebar moved to `docs/src/sidebar.mjs` so the endpoint can read it. A `Head` override adds `<link rel="alternate" type="text/markdown">` to each docs page. The home page has a short section that links to the Markdown versions and to `llms.txt`. No new dependency.
- Reason: The starlight-docs skill recommends `starlight-page-actions` for the `.md` routes and `starlight-llms-txt` for `llms.txt`. Both were installed and tested. `starlight-page-actions` 0.7.1 copies the MDX source through `tidymd`, which leaves the `export const` strings and the `<Example>`, `<Options>` and other tags in place, and removes lines that start with `import` inside the example strings, so it changes the code of the examples. `starlight-llms-txt` 0.12.0 writes an `llms.txt` that links only to the full and small sets, not to each page, and builds its content from the rendered HTML, which drops the fence line of every code block. On this site the fence line is the content. A page action plugin would also own the `.md` routes, so it cannot sit next to own endpoints.
- Alternatives: `starlight-page-actions` with its raw copy (broken examples, JSX in the output). `starlight-llms-txt` for `llms-full.txt` and `llms-small.txt` (no fence lines; a second converter with different output). A `.md.txt` alias (GitHub Pages serves `.md` as `text/markdown`, so no reader needs it yet).

## Page actions on the docs site

- Date: 2026-09-26
- Step: after the plan (docs site)
- Decision: A `PageTitle` override in `docs/src/components/PageTitle.astro` shows four actions under the title of each docs page: **Copy as Markdown** (a button that fetches the page's `.md` and writes it to the clipboard, with a live status), **View as Markdown**, **Open in Claude** and **Open in ChatGPT** (links with a prompt that names the absolute `.md` URL and what the docs are about). The copy button is hidden until its script runs, so readers without JavaScript see only links. The controls use Starlight colour tokens, are at least 32 px high and show an accent outline on keyboard focus. No new dependency.
- Reason: `starlight-page-actions` renders its buttons from its own `PageTitle` override, but it also owns the `.md` routes, which this site serves itself (see "Markdown routes and llms.txt on the docs site"). Its prompt names the HTML URL, not the Markdown. Four plain controls wrap at 360 px and need no menu, so they need no menu keyboard handling.
- Alternatives: `starlight-page-actions` (collides with the site's `.md` routes). A dropdown for the assistants (more code and keyboard handling for two links). More assistants (each helps only the readers of one product).

## Share cards on the docs site

- Date: 2026-09-26
- Step: after the plan (docs site)
- Decision: `docs/src/pages/og/[...slug].ts` renders a 1200 × 630 px PNG card for each docs page at build time with `astro-og-canvas` 0.13.2: the logo, the page title in Inter Bold and the description in Inter Regular, on a dark navy gradient from the logo with a border in the logo's purple. The route rasterises `src/assets/logo.svg` with `sharp` 0.35.4 at build time, because CanvasKit cannot draw SVG. The `Head` override adds `og:image` (absolute, from `site` and `base`), its width, height and alt text, and `twitter:image`; pages outside the docs collection, such as the 404 page, get the home page's card. `canvaskit-wasm` 0.42.0 is a direct dependency of the docs site, because `astro-og-canvas` cannot load it under pnpm otherwise (`__dirname is not defined`). The first build on a machine downloads the two Inter files from `api.fontsource.org` and caches them in `node_modules/.astro-og-canvas`.
- Reason: Starlight writes every OpenGraph tag except the image, so shared links showed no picture. `astro-og-canvas` is the approach of the starlight-docs skill and of Starlight's own docs. Inter is close to the system sans-serif fonts that the site shows. The docs build already needs the network (the Python `objects.inv`).
- Alternatives: Satori or a headless browser (more dependencies, slower builds). A committed PNG of the logo (drifts from the SVG). The site name as text on each card (the card has only a title, a description and a logo; the logo marks the site).

## Find rendered lines through a line map, not by index

- Date: 2026-09-26
- Step: after the plan (compatibility with other plugins)
- Decision: The core plugin records the rendered element of each line in `postprocessRenderedLine`. Annotations, callouts, footnotes and hidden lines look up a line's element with `lineElement(line)` and insert nodes before it with `insertBefore()`, wherever the line sits. Hidden lines no longer rebuild the children of `<code>`. The components (`<CodeSteps>`, `<Scrollycoding>`) and the expandable client module work on rendered HTML, so they count `.ec-line` elements but skip a collapsed section's `summary` line. `@expressive-code/plugin-collapsible-sections` is a devDependency, only for the unit tests in `test/compat.test.ts`.
- Reason: Another plugin's `postprocessRenderedBlock` can run before ours. `@expressive-code/plugin-collapsible-sections` adds a summary line and moves lines into `<details>`, so the n-th `.ec-line` was no longer line n: annotations and footnotes landed on the wrong line, and hidden lines flattened the `<details>` away. `expressive-code-twoslash` nests other blocks inside lines.
- Alternatives: Tell users to list `pluginCodeblocks()` first (fragile, and not possible when a theme adds plugins). Data attributes on each line (extra markup in every block).

## Client modules work in copies of a block

- Date: 2026-09-26
- Step: after the plan (compatibility with other plugins)
- Decision: Hidden lines, expandable blocks and the Run button listen for clicks on the document and find their targets from the event target, inside the block (`closest()`), not with `document.getElementById`. Line permalinks find lines inside the clicked block. Annotation buttons in a copy of a block open the popover right after them, not the popover that `popovertarget` finds by id; popover placement listens for `toggle` on the document in the capture phase. When starlight-codeblock-fullscreen puts its button in the title bar, the plugin's controls move 2.25rem away from the end. The Playwright tests in `docs/e2e/compat.test.ts` copy a block into an overlay and add a copy of the full screen button, as the other plugin does, so the docs site does not depend on it.
- Reason: Full screen plugins show a `cloneNode(true)` copy of the block. The copy has the same ids, no event listeners and the `-ready` markers of the original, so its controls did nothing, or acted on the original. The full screen button covered the step buttons of `<CodeSteps>`.
- Alternatives: Give each copy new ids (the other plugin makes the copy). Watch the DOM for new blocks with a `MutationObserver` (more code in every module). The hover-only decorations, field edits and `<CodeSteps>` navigation came later (see "Every client feature works in copies of a block").

## Tests for other plugins without depending on them

- Date: 2026-09-26
- Step: after the plan (compatibility with other plugins)
- Decision: The package's unit tests use `@expressive-code/plugin-collapsible-sections` (a devDependency) and small fake plugins that remove lines the way `expressive-code-twoslash` does. The test for `ec.config.mjs` bundles calls `packageRoot()` with the path of a bundled chunk in the docs site, rather than an extra e2e site with `ec.config.mjs` and a `<Code>`-only page.
- Reason: The repository must not depend on third-party Starlight plugins at runtime, and a second site for one path lookup adds a full build to CI for a one-line check.
- Alternatives: An e2e fixture site per plugin (slow, and the scratch compatibility site already covers the real plugins by hand).

## Markdown features under the unified() processor

- Date: 2026-09-26
- Step: after the plan (compatibility with other plugins)
- Decision: When `markdown.processor` is Astro's `unified()` (from `@astrojs/markdown-remark`), the integration pushes one remark plugin to `processor.options.remarkPlugins`: `remarkFromSatteri()` in `src/satteri/remark.ts`, which runs the same Sätteri plugin definition from `mdastPlugins()` over the remark tree. The code switcher, `{:lang}` inline highlighting, mention link checks and the duplicate id check work the same. Each feature keeps one implementation. The adapter gives visitors the part of Sätteri's context that the package uses (`parent`, `indexOf`, `replaceNode`, `removeNode`, `setProperty`, `before` and `after`), and turns a returned `html` node into hast (`data.hName`, `hChildren`), so that it renders in `.md` and `.mdx`. Starlight 0.42 adds `remark-directive` under `unified()`, so directive nodes have the same shape. Sätteri stays the primary path and the docs site stays on Sätteri. AGENTS.md now limits the "no remark or rehype plugins" rule to the docs site. `@astrojs/markdown-remark` and `remark-directive` are devDependencies, for `test/remark.test.ts`, which runs the adapter through Astro's own Markdown processor. No new runtime dependency: the adapter needs neither `unified` nor `unist-util-visit`.
- Reason: The user wants the plugin to follow current Astro and Starlight practice without limiting which sites can use it. Plugins such as starlight-markdown-blocks need `unified()`, and on those sites the features were off without any message. The scratch compatibility site with `UNIFIED=1` and starlight-markdown-blocks passes the same checks as the Sätteri build, and logs the same warnings.
- Alternatives: A warning that names the features that are off under `unified()` (loses the features). A second, remark-native implementation of each feature (two copies to keep in step). An end-to-end fixture site on `unified()` (a full extra build in CI; the unit tests run Astro's real processor, and the scratch site covers a real Starlight build).

## An exclude function for starlight-links-validator

- Date: 2026-09-26
- Step: after the plan (compatibility with other plugins)
- Decision: The package exports `linksValidatorExclude({ link })`. It returns `true` for `#mention:` links and for links whose hash is the `id` of a Markdown code block, alone or with `-L<n>` or `-L<n>-L<m>`, on any page. The Sätteri plugin records each block `id` in the registry while it checks for duplicates, and the validator calls the function in `astro:build:done`, after every page has rendered. The docs site uses it instead of its own `#mention:` check.
- Reason: starlight-links-validator collects the ids of a page before Expressive Code renders, so it reports links to block and line ids as broken and fails the build.
- Alternatives: A glob list for users to write (cannot know the block ids). Ids recorded per page (the validator gives the file of the link, not of the target, and a block id on another page is just as valid).

## One marker on every decoration

- Date: 2026-09-26
- Step: after the plan (compatibility with other plugins)
- Decision: The core plugin gives every element that a feature adds to a block but that is not code the class `scb-deco` and `data-pagefind-ignore`, in `postprocessRenderedBlockGroup`, from one list in `core.ts`: title bar controls, screen reader text, line state labels, annotation buttons and popovers, footnote badges, callouts, hidden-line markers, the expandable bar, run output and permalink numbers. `<CodeSteps>` marks its step numbers the same way. The step labels of token transitions stay unmarked, because they are text that readers see without JavaScript. A fill-in field keeps its text in a `display: none` span next to the `<input>`, so that tools that skip inputs still read it; the field still works without JavaScript, as SPEC asks. The docs show one `starlight-llms-txt` setting: `customSelectors: { all: ['.scb-deco'] }`. `readTokens()` for the components uses the same marker. The unit test helper `render()` strips the marker from `html`, so that each feature test checks its own markup, and `test/decorations.test.ts` checks that the text of a block without its decorations is the copied text.
- Reason: Tools that turn the page's HTML into text, such as starlight-llms-txt, put labels, button numbers, popover text and step numbers into the code, and dropped the placeholder text. The docs build's Pagefind index had the same text in its code excerpts, such as `Error:for name in sys.argv[1:]Error SyntaxError`.
- Alternatives: A data attribute (a class is shorter to write as a selector). One selector for each feature in the docs (a long list that breaks when a feature changes). A visually hidden copy of the placeholder text (screen readers would read the text twice).

## Every client feature works in copies of a block

- Date: 2026-09-26
- Step: after the plan (compatibility with other plugins)
- Decision: The features that "Client modules work in copies of a block" left out now work in a copy too. Bracket pairs and side-by-side note highlights listen for `mouseover`, `focusin` and `focusout` on the document and light up inside the block of the event target. API link cards use one card, which moves into the block of the link it shows. Fill-in fields keep each template in `data-scb-template`, so that a copy fills its own copied code from the template, and a copy gets its own update function the first time a reader types in it. `<CodeSteps>` gives each step `data-scb-steps-of`; in a copy of a step, Previous, Next, the step numbers and the arrow keys swap in the title, step numbers, controls, code and copy button of the step they go to, without the animation, and keep what other plugins added to the copy, such as a full screen button. The menu of a code switcher in a copy of one variant swaps in the variant it picks the same way (`data-scb-switcher-of`), and switches the page too. Both use `swapInto()` in `src/client/shared/swap.ts`.
- Reason: The user prefers working features in the copies that full screen plugins show over known limits.
- Alternatives: The token animation in a copy (the copy has one step and no step data; the swap keeps the code correct).

## Inline code suffix inside the backticks

- Date: 2026-09-26
- Step: after the plan (compatibility with other plugins)
- Decision: Inline highlighting also takes the suffix inside the backticks, `` `fetch(url){:js}` ``, and the docs recommend that form. The form after the backtick, `` `fetch(url)`{:js} ``, still works, and the docs say to write `\{:js}` in `.mdx` files and on sites whose plugins read `.md` as MDX. Inline code that contains a backtick, or that is only a suffix, keeps its text, so that docs can show the syntax. The token form `{:.token}` is not supported, so a suffix that starts with a dot stays as text.
- Reason: The form inside the backticks is the one that rehype-pretty-code documents (`` `[1, 2, 3]{:js}` ``); SPEC 8.1 names rehype-pretty-code as the source of the convention. It is valid Markdown and valid MDX, so it needs no backslash, and it works with starlight-versions and starlight-md-txt, which read `.md` files as MDX and fail on `{:js}` after the backtick.
- Alternatives: Only document the backslash (every author has to remember it, and plain `.md` breaks as soon as a site adds one of those plugins). A different syntax, such as a `lang` attribute (no existing convention).

## No toPlainMarkdown export

- Date: 2026-09-26
- Step: after the plan (compatibility with other plugins)
- Decision: The package does not export a function that removes attributes and directives from Markdown. The "Use with other plugins" guide says that page action and raw Markdown plugins show the source as the author wrote it.
- Reason: None of starlight-page-actions, starlight-page-context-action and starlight-md-txt has a hook that could call such a function, so sites could not use it. Directives are code comments, which readers and AI assistants can read, and fence line attributes are the Markdown that the author wrote.
- Alternatives: Export it anyway (an unused API that must parse every comment syntax and every attribute).

## A guide for other plugins

- Date: 2026-09-26
- Step: after the plan (compatibility with other plugins)
- Decision: The guide "Use with other plugins" (`guides/use-with-other-plugins`, last in the Guides group of the sidebar and so in `llms.txt`) lists the tested plugins in groups, gives the plugin order, and has one section for each plugin that needs a set-up: `ec.config.mjs` and expressive-code-twoslash, starlight-links-validator, starlight-llms-txt and Pagefind, page actions, starlight-versions and starlight-md-txt, Markdoc, and `unified()`. It uses sections and lists, and no wide tables.
- Reason: The compatibility tests found set-ups that readers cannot guess, and each belongs to no single feature page.
- Alternatives: A page under Extend (those pages define interfaces). Notes on each feature page only (readers look for the other plugin's name, not the feature).

## Logotype

- Date: 2026-09-26
- Step: after the plan (user request)
- Decision: A logotype of the terminal window mark and the name "starlight-codeblocks" in Michroma 400, lowercase, at 88 units on a 132 unit high canvas with 0.02 em letter spacing, the same as the starlight-pydocs logotype. The text is outlined to paths, because an SVG in an `<img>` cannot load a web font. The README uses `.github/assets/logotype.svg` in a plain `<img>`: one file with a transparent background whose text colour changes through `@media (prefers-color-scheme: dark)` (`#1b1f2a` light, `#f4f5f8` dark). The docs site uses the logotype as the Starlight `logo` with `replacesTitle`, as starlight-pydocs does, but through two files with fixed colours (`docs/src/assets/logotype-light.svg` and `logotype-dark.svg`). The square logo stays for the favicon, the share cards and the touch icon.
- Reason: The user asked for the starlight-pydocs font and one SVG that follows light and dark mode. In an `<img>`, the SVG's `prefers-color-scheme` follows the viewer's system setting, which is what GitHub's own theme follows by default. The Starlight theme picker does not change the system setting, so the docs site needs the light and dark pair that Starlight switches.
- Alternatives: A `<picture>` pair with two files, as the starlight-pydocs README has (the user asked for one file). Live `<text>` with a web font (does not load in an `<img>`). Committing the Michroma font file (not needed after outlining).

## Feature groups by what they are used for

- Date: 2026-09-26
- Step: after the plan (docs structure)
- Decision: The sidebar groups the features by what authors use them for, in eight groups of two to five pages: Explain code (annotations, footnotes, inline callouts, side-by-side annotations, scrollycoding), Draw attention (focus, line states, code mentions), Show what changed (word-level diff, token transitions), Shorten long code (hidden lines, expandable blocks), Make code easier to read (visible whitespace, colourised brackets, inline code highlighting), Link code (token links, API auto-linking, line permalinks), Adapt to the reader (code switcher, fill-in placeholders) and Copy and run (smart shell copy, open in playground, run in the browser). Comment notation is syntax that many features read, so it moves to "Start here". Page URLs do not change. The README, `llms.txt`, the accessibility page and the home page use the same groups in the same order.
- Reason: The user found the groups by where a feature works ("Inside the code block", "Across the page", "More") not useful. The user put scrollycoding in "Explain code", next to side-by-side annotations, because a walkthrough explains code.
- Alternatives: A "Walk through code" group, which had only scrollycoding. A "Connect prose and code" group for code mentions and scrollycoding (the first version of this change).

## Feature carousel on the home page

- Date: 2026-09-26
- Step: after the plan (docs structure)
- Decision: The home page has a carousel in place of the hero block and the list of groups. Each `<Feature page="…">` slide is live MDX, so features that need prose or components (code mentions, inline code, the code switcher, `<CodeSteps>`, `<Scrollycoding>`) work as on their pages. The slides share one grid cell, so the carousel keeps the height of the tallest slide and the buttons under it do not move when the slide changes. Scrollycoding and side-by-side annotations are `tall`: they are out of the layout while they are not the current slide, because their height (about 1,000 px for scrollycoding, and the notes list under the block on phones) would leave most other slides empty. The rotation follows the WAI carousel pattern: a Pause and Play control, pause on hover and on focus (but not on focus of the control itself), rotation off under reduced motion, and a polite live region that says the feature name only when the reader selects a slide. Selecting a feature stops the rotation, because the reader has chosen what to read. The button grid comes from `docs/src/sidebar.mjs`. The Markdown version of the page lists the features in their groups.
- Reason: The user asked for a carousel with one example at a time, a button with an icon for each feature, grouped as in the sidebar, and a link to the feature page under the example.
- Alternatives: A slide area that takes the height of each slide (the buttons move under the pointer after a click). An inner scroll box for scrollycoding (its steps activate in the middle of the window, so they would not activate reliably in a box).

## Lucide icons for the home page, axe for its test

- Date: 2026-09-26
- Step: after the plan (docs structure)
- Decision: The feature buttons use icons from `lucide-static` (ISC licence), a dev dependency of the docs site only. The component imports the SVG strings at build time and puts them inline with `aria-hidden`, so the page loads no icon library. `@axe-core/playwright` (MPL-2.0, dev dependency of the docs site) checks the home page in the e2e tests, with Expressive Code's `landmark-unique` rule off (an upstream issue) and contrast results allowed only on faded lines.
- Reason: Starlight's built-in icon set has no suitable icon for most of the 24 features. Lucide has one for each, in one consistent style.
- Alternatives: Tabler icons (also suitable; MIT). Copying the SVG paths into the repository, which would need the licence text next to them.

## Comment notation dropped from the home page carousel

- Date: 2026-09-26
- Step: after the plan (docs polish)
- Decision: `<FeatureCarousel>` excludes `features/comment-notation` from the slides and the picker, even though it is still a `features/…` page in the "Start here" sidebar group. `docs/src/index.mdx` no longer has a `<Feature page="features/comment-notation">` slide. "Start here" then has no features, so it drops out of the carousel groups (its `.filter((group) => group.features.length > 0)` already handles this), and the carousel opens on "Explain code" → Annotations. The sidebar keeps comment notation under "Start here", because that is where authors learn the directive syntax before they use it in a feature.
- Reason: The user said comment notation is shared syntax, not a feature in its own right, and one of the least impressive things to lead with on the home page.
- Alternatives: Move comment notation to a different sidebar group so the existing "every `features/…` item is a slide" rule keeps working unchanged. Rejected: the sidebar placement under "Start here" is deliberate (see the "docs structure" decision above) and the user did not ask to change it.

## Comment notation example: highlight first, diff pair set off by plain lines

- Date: 2026-09-26
- Step: after the plan (docs polish)
- Decision: The canonical comment-notation example (`config.ts`, previously `port: 3000 [!code --]` / `port: Number(...) [!code ++]` / `host: 'localhost' [!code highlight]` back to back) is now: a highlighted line first (`host`), a plain line (`protocol`), the `--`/`++` pair, then a plain line (`timeout`). Updated everywhere it appeared: `docs/src/content/docs/features/comment-notation.mdx`, `docs/src/content/docs/index.mdx` (removed, see above), `README.md` (and its copy in `packages/starlight-codeblocks/README.md`), `docs/e2e/comment-notation.test.ts`, and the README media PNG (`pnpm readme:media comment-notation`).
- Reason: The user asked for the highlighted line to lead and for un-highlighted lines to separate each marked line, here and in the README, so each marker reads as its own thing instead of a wall of coloured lines.
- Alternatives: None; this replaces `design/mockups.html`'s version of the same example (diff pair first, highlight last, no spacing), which is now out of date for this one example.

## Home page carousel: buttons above the slide, dots below it, roving tabindex

- Date: 2026-09-26
- Step: after the plan (docs polish, user request)
- Decision: In `docs/src/components/FeatureCarousel.astro`, the grouped feature button grid (`.picker`) now comes before the card, not after it, so a reader sees the choices before the current slide. Under the slide, a row of 23 dots (one per slide, `.dots`, `role="group"` labelled "Slides") shows the carousel cycles, with the Pause/Play control beside it (both in one `.controls` row, centred, wrapping on narrow screens). The current dot is an elongated pill (not colour alone); while rotating, its fill grows over the 7 s interval as a CSS transition (so it animates in the visitor's real time regardless of any fake clock in a test), frozen (not reset) by the same pause/hover/focus logic as the slide rotation, and off entirely under reduced motion. Each dot's accessible name is "Show slide N: `<Feature>`"; the button is 24 by 24 px with a smaller visible pill inside. Dots use one roving tabindex (only the current dot is a tab stop; Left/Right/Home/End move focus and jump to that slide, matching the WAI-ARIA carousel pattern's slide-picker guidance), rather than 23 more individual tab stops next to the 23 tiles already in the picker. Clicking or arrow-keying to a dot behaves like clicking its tile: it jumps to that slide, announces it and stops the rotation. Without JavaScript the dots are hidden (`hidden` until the script runs), like the Pause/Play control, since a static row of dots with no working rotation or Enter/Space activation would be confusing chrome.
- Reason: The user asked for dots to show the carousel cycles, for the buttons to move above the slide, and for the current dot to show progress towards the next slide.
- Alternatives: `role="tablist"`/`role="tab"` on the dots (the slides use `aria-roledescription="slide"`, not `role="tabpanel"`, so full tab semantics would be a mismatch; a `group` of buttons with `aria-current` and roving tabindex reads correctly without it). A per-frame `requestAnimationFrame` progress loop reading `performance.now()` (tried first; under Playwright's fake clock, `setTimeout`/`Date` are faked but `requestAnimationFrame`/`performance.now()` were not, so the fill grew in real wall-clock time regardless of `clock.runFor()`, which is both untestable and pointless — the CSS transition gives the same real-time visual growth natively, and its `transition-duration`/target width are plain, faked-clock-friendly properties to assert on). Giving every dot its own tab stop (rejected above).

## Shorten long code folded into Make code easier to read

- Date: 2026-09-27
- Step: after the plan (docs polish, user request)
- Decision: The "Shorten long code" sidebar group (hidden lines, expandable blocks) is gone. Its two pages move into "Make code easier to read", first in the group, ahead of visible whitespace, colourised brackets and inline code highlighting. Updated in `docs/src/sidebar.mjs` (the single source; `llms.txt`, the home page carousel and its Markdown copy read from it), `README.md` (and its copy in `packages/starlight-codeblocks/README.md`), `design/DOCS-SITE.md`'s sidebar listing and `docs/src/content/docs/reference/accessibility.mdx`. Page URLs, slide count (23) and slide order do not change, so `docs/e2e/carousel.test.ts`'s position assertions needed no edit.
- Reason: The user asked for hidden lines and expandable blocks to count as a way of making code easier to read, not a separate reason for using the plugin.
- Alternatives: None; a straight merge, with the two moved pages leading the merged group because hiding or collapsing code is a precondition for reading what is left, before the finer visual aids.

## Home page carousel: explicit column counts for the button grid, not `column-width`

- Date: 2026-09-27
- Step: after the plan (docs polish, user request)
- Decision: In `docs/src/components/FeatureCarousel.astro`, `.picker` no longer uses `column-width` to pick its own column count. `.carousel` is now a container (`container-type: inline-size`), and `.picker` uses `@container` queries to set an explicit `columns` count: 1 below 420px, 2 from 420px, 3 from 640px. The seven sidebar groups hold from 2 to 5 buttons each, so a fixed `column-width`'s `floor()` arithmetic could not put 3 columns at both the desktop content width (1080px) and the tablet width (736px) at once: any value narrow enough for 3 columns at 736px gave 4 or more at 1080px, which is the uneven 8/7/5/3 split the user reported. With explicit counts, the browser's own `column-fill: balance` (unchanged, still the default) lands on the same group boundaries this partition problem's optimum works out to by hand: 3 columns split as [Explain code, Draw attention] / [Show what changed, Make code easier to read] / [Link code, Adapt to the reader, Copy and run] at every width from 736px to at least 1080px (checked at 1920, 1440, 1280, 1024 and 768px), and 2 columns split as [Explain code, Draw attention, Show what changed] / [Make code easier to read, Link code, Adapt to the reader, Copy and run] below that, down to 1 column at 360px with no overflow. Group order and `break-inside: avoid` are unchanged, and the DOM order is untouched, so tab order still follows reading order at every width.
- Reason: The user asked for the columns to balance visually at every width, screenshotted at 1920, 1440, 1280, 1024, 768 and 360px.
- Alternatives: Keeping `column-width` and only widening its value (tried first): balances well at a single width but, per the `floor()` argument above, cannot give 3 columns across the whole 736–1080px range the six checkpoints span. A build-time partition into per-breakpoint DOM orders (so each breakpoint's reading order exactly matches its own visual columns) was also considered and rejected: it would need a separate copy of the 23 buttons per breakpoint, which multiplies the picker-to-slide wiring the carousel script does by tile and breaks the "23 tiles" assumption in `docs/e2e/carousel.test.ts` and the accessibility tree, for no gain over container queries, which already keep one DOM order matching visual reading order at every width.

## Home page hero like starlight-pydocs, with Michroma page titles

- Date: 2026-09-27
- Step: after the plan (docs polish, user request)
- Decision: The home page hero has the square terminal logo (`docs/src/assets/logo.svg`) as its image, a two-sentence tagline that replaces the introduction paragraph (what the plugin adds, to which code blocks, and that a feature starts only when a block uses its attribute or directive), and two actions, "Get started" and "GitHub". The hero title and every page title (`h1#_top`, `.hero h1`) use Michroma 400, the face of the logotype, with the same size clamp and line height as starlight-pydocs. Section headings keep the Starlight font, as in starlight-pydocs. The font comes from `@fontsource/michroma` 5.3.0 (a docs dev dependency, not a package dependency), imported in `docs/src/styles/custom.css`: Vite copies the WOFF2 files into the build, so the site serves the font itself, and the package carries the SIL Open Font License 1.1. The Markdown version of the home page adds the tagline, with its links as Markdown links, under the description.
- Reason: The user asked for the home page to look like the starlight-pydocs home page, with the terminal icon and the headings font, and for the tagline to say what the introduction paragraph said. `@fontsource/michroma` is how starlight-pydocs loads the face for its titles. The long titles ("Choose an annotation style") wrap inside the column at 360 px with no overflow.
- Alternatives: Check a Michroma file and `OFL.txt` into `docs/src/assets/fonts/`, as starlight-pydocs does for its share cards only (not needed: the share cards here use Inter, and Fontsource ships the licence with the files). Michroma for all headings (starlight-pydocs does not do this, and the wide face makes `h2` headings wrap early on phones).

## Home page carousel: one flat button grid, no group headings; hero padding-bottom tightened

- Date: 2026-09-27
- Step: after the plan (docs polish, user request)
- Decision: Supersedes "Feature carousel on the home page" (the grouped-picker part), "Lucide icons for the home page, axe for its test" only where it mentions groups, "Home page carousel: buttons above the slide, dots below it, roving tabindex" only where it mentions groups, and "Home page carousel: explicit column counts for the button grid, not `column-width`" in full. `docs/src/components/FeatureCarousel.astro`'s picker is now one flat `<ul>` of the 23 feature tiles in sidebar order (still filtered and ordered from `docs/src/sidebar.mjs`, `features/comment-notation` excluded as before), with no group wrapper, heading or `role="group"`. It is a plain CSS grid, `grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr))`, with no container queries or JavaScript column logic. `14rem` is the smallest basis that keeps every label, including the two longest ("Side-by-side annotations", "Inline code highlighting"), on one line at the column counts this produces (checked at 1920, 1440, 1024, 768 and 360px content widths of 1080, 1080, 992, 736 and 328px: 4, 4, 4, 3 and 1 columns). Since 23 is prime, no column count divides it evenly; 4 and 3 columns both leave a partial last row (3 of 4, 2 of 3) with no lone orphan tile, which the four required checkpoints (1440, 1024, 768, 360) all land on. A narrow window around 2 columns (roughly 670–750px viewport) does produce a single orphan in the last row; this is accepted, since it needs no screenshot check and a prime item count cannot avoid every such window without reintroducing per-breakpoint column-count logic. Separately, `docs/src/styles/custom.css` adds `.hero { padding-bottom: 1.5rem }` under `@media (min-width: 50rem)`, overriding only Starlight's own `.hero` `padding-block` bottom half (which grows up to 10rem, i.e. up to 160px, on wide screens) without touching its `padding-top` or any other hero layout. `docs/e2e/carousel.test.ts`'s group test is replaced with a check that `.carousel .group-label` no longer exists and that the 23 tiles appear in the same order as the sidebar's own `features/…` links (comment notation excluded).
- Reason: The user said the hero had too much whitespace under it and that the carousel's grouping was "horrible", asking to drop the group headings entirely. Measured before/after at 1440px: hero `padding-bottom` drops from 106px to 24px (top padding unchanged), roughly halving the gap between the hero actions and the "Features" heading.
- Alternatives: Keeping groups but making them less visually heavy (not what the user asked for — they asked to drop grouping "completely"). A smaller fixed number of columns instead of `auto-fill` (loses the automatic 1-column collapse on phones that `auto-fill` already gives for free). Overriding the hero's whole `padding-block` (would also change `padding-top`, altering the hero's own look, which the user did not ask to change).

## Carousel: scroll the chosen example into view, only as far as needed

- Date: 2026-09-27
- Step: after the plan (docs polish, user request)
- Decision: `docs/src/components/FeatureCarousel.astro`'s tile click handler now calls a `revealCard()` helper after `show()`, so it measures the card once the new slide (whose height can differ, for the two `tall` slides) is in the DOM. It reads the sticky header's own rendered height (`.header`, a `position: fixed` element from Starlight's `PageFrame`) rather than parsing `--sl-nav-height`, since the element gives the exact on-screen value at any viewport width with no unit parsing. Visible fraction is `visible / min(cardHeight, viewportHeight - headerHeight)`; below 0.5 it scrolls by `window.scrollBy`, `behavior: 'smooth'` unless `prefers-reduced-motion: reduce`. The distance is the card's top offset from the header when the card is taller than the space below the header, or when only its top is cut off; otherwise (only its bottom is cut off) it's the card's bottom offset from the viewport's bottom edge. Dot clicks and auto-rotation do not call `revealCard()`, only tile clicks (which also covers keyboard activation, since `Enter`/`Space` on a `<button>` dispatches the same `click` event).
- Reason: The user asked for this exact behaviour: don't scroll if the example is already half visible, and otherwise scroll only as far as needed, stopping at whichever edge matters (full visibility when it fits, top-under-header when it doesn't).
- Alternatives: `scrollIntoView()` with `block: 'nearest'` (its "already visible" check is not the same as this half-visible threshold, and it cannot align to below a `position: fixed` header without `scroll-margin-top`, which would also shift browser-native anchor scrolling on this page). Reading `--sl-nav-height` from computed style (needs parsing a `rem`/`px` value; the header element's own rect is simpler and can't drift out of sync with what's actually rendered).

## Carousel: "Read docs" button top-right of the slide header, not a link under the example

- Date: 2026-09-27
- Step: after the plan (docs polish, user request)
- Decision: `docs/src/components/Feature.astro`'s link to the feature's own page moves from a `<p class="more">` below the live example to a pill-shaped button-styled `<a>` at the top right of the slide, beside the title and summary (a new `.head` flex row: `.text` (title + summary) grows to fill the space, the link stays a fixed-width item at the end, so it lands in the same spot on every slide as titles vary in length). Visible text is "Read docs"; the accessible name is `Read docs : <Feature>` (visible text first, per WCAG 2.5.3), built with `Read docs<span class="sr-only">: {title}</span>` plus a trailing `right-arrow` `Icon` (internal navigation, matching the hero's "Get started" icon rather than the "GitHub" action's external icon). The extra space before the colon is Chromium's own accessible-name computation, which joins the text node and the following `<span>`'s content with a space regardless of markup whitespace; `docs/e2e/carousel.test.ts` asserts the name browsers actually compute, not the source string. Styled like the picker tiles it sits above (`border: 1px solid var(--sl-color-gray-5)`, `color: var(--sl-color-white)`, hover lightens the border), not Starlight's own `sl-link-button`, since it lives on the carousel's card rather than the page body. `docs/src/markdown.ts` needed no change: `<FeatureCarousel>` is replaced wholesale by `featureList()` in the Markdown output, so the old link text never reached it.
- Reason: The user asked for the per-slide "Read the … documentation" link to become a short "Read docs" button fixed at the top right of the panel, in the same place on every slide.
- Alternatives: `position: absolute` on the link with a fixed `padding-inline-end` reserved on the title (rejected: needs a guessed pixel reserve that can go stale as title text or font metrics change; the flex row computes the split itself and wraps the title under it naturally at 360px with no magic number).

## Smart shell copy: a Copy commands button, and the copy button copies the whole block

- Date: 2026-09-27
- Step: after the plan (user request)
- Decision: Deviates from SPEC 6.8 at the user's request. Smart shell copy no longer changes Expressive Code's copy button: it copies the whole block, prompts, commands and output, with Expressive Code's own removal of `#` comment lines in terminals (the plugin puts the prompts back into `data-code`, since it moved them out of the code). A **Copy commands** `scb-btn` in the title bar (`addTitleBarControl()`) copies the commands only, from its own `data-code`. A client module (`src/client/shell-copy.ts`, loaded on pages with `[data-scb-shell-copy]`) writes it to the clipboard, changes the label to "Copied" for 1.5 s with the width kept, and fills a polite live region next to the button, as Expressive Code's copy button does. The placeholders module now updates every `button[data-code]` in a block, so the button copies the reader's values. Without JavaScript the button is hidden (`@media (scripting: none)`). Manual selection: prompts stay unselectable, output lines are selectable again.
- Reason: The user said that a copy button that copies something other than the whole block changes the default behaviour of a normal button, which is confusing. For manual selection, the least surprising result is the normal one, except for prompts: leaving the prompt out of a selected command is the common convention on docs sites, and readers never want `$ ` in a paste. Output that readers select by hand, such as an error message, they want to get.
- Alternatives: Keep the output unselectable (a reader who selects an error line to search for it gets nothing). Make prompts selectable too (a triple-click on a command then pastes `$ ` into the shell).

## Code switcher: a language icon in the menu, and a drawn chevron with room at the edge

- Date: 2026-09-27
- Step: after the plan (user request)
- Decision: The code switcher's menu is now `span.scb-switcher-field` with three children: a 14 px language icon at the start, the native `select` (with `appearance: none` and room in its padding for the two glyphs), and a 10 px drawn chevron 8 px from the end edge. Both glyphs are `aria-hidden` SVG in `currentColor`. Each variant is its own block with its own menu, so the icon is the language of that block, chosen at build time, and it changes with the variant with no client code. The icons are Seti UI icons, the set that Starlight's FileTree uses, for 33 common languages and their aliases, embedded as path data in `src/expressive-code/language-icons.ts` with the MIT notice. Other languages get a generic `< >` code icon. The entries of the open menu have no icons.
- Reason: The user asked for language icons to the left of the menu, and for margin at the right of the chevron. Starlight has the Seti icons but does not export them (they are in `dist/components-internals/` and `dist/user-components/`, outside its `exports` map), so the package cannot import them; copying the paths needed is small (about 40 kB of source, rounded to two decimals), needs no new dependency, and matches the look of Starlight's own file icons. A drawn chevron sits at the same place in every browser; the native chevron's position depends on the browser and touched the edge in Chromium. Icons in the open list need `appearance: base-select`, which only Chromium supports, and the variant data has only labels, not languages, so the progressive enhancement is left out.
- Alternatives: simple-icons (CC0) or devicon (MIT) as a dependency (a new runtime dependency for 33 paths, and brand colours that do not follow the theme). Keep the native chevron with more `padding-inline-end` (where the arrow sits still depends on the browser).

## Example component: "Readers see" first, "You write" second

- Date: 2026-09-27
- Step: after the plan (user request)
- Decision: Supersedes the pane order in "Example component reverts to stacked panes, output and Markdown both visible". `docs/src/components/Example.astro` puts the rendered output ("Readers see", `.pane.output`) first and the Markdown source ("You write", `.pane.source`) second, in the stacked and the `side` layouts. The panes have `output` and `source` classes, and every e2e test and `scripts/readme-media.mjs` find a pane by class, not by position. The focus test that tabbed from the source pane's copy button into the output now tabs from a button put before the example.
- Reason: The user asked for the output first on every docs page: readers come to see what a feature does, then how to write it. Class names keep the tests correct if the order changes again.
- Alternatives: `flex-direction: column-reverse` (the visual order would differ from the DOM and tab order, which fails WCAG 1.3.2 and 2.4.3).

## Home page carousel: the buttons read down each column

- Date: 2026-09-27
- Step: after the plan (docs polish, user request)
- Decision: Supersedes the layout part of "Home page carousel: one flat button grid, no group headings". The `.picker` list in `docs/src/components/FeatureCarousel.astro` is a CSS multi-column list, `columns: 14rem` with a 0.5rem column gap, and each `li` has `break-inside: avoid` and 0.5rem of bottom padding. The browser balances the columns, so the 23 tiles fill each column top to bottom in sidebar order: 6/6/6/5 at 1440 and 1024 px, 8/8/7 at 768 px, one column at 360 px, with the tiles of every column on the same rows and every label on one line. `docs/e2e/carousel.test.ts` checks the column order, the even lengths and the row alignment.
- Reason: The user asked for the buttons to go top to bottom, not left to right. Multi-column keeps the same `14rem` basis, so the column counts do not change, and it needs no count of the tiles or rules for each width. The DOM and tab order are the sidebar order, which is now also the visual reading order down each column.
- Alternatives: Grid with `grid-auto-flow: column` and `grid-template-rows: repeat(n, auto)` (needs the row count for each column count, so a media or container query for each width).

## Inline code highlighting example: a blockquote that explains the plugin's own mechanics

- Date: 2026-09-27
- Step: after the plan (docs polish, user request)
- Decision: The first `<Example>` on `features/inline-code-highlighting.mdx` is now a two-paragraph Markdown blockquote, so the rendered output reads as a quoted example rather than page prose. The two paragraphs describe, in inline code across six languages (js, sh, ts, css, py, html), how the plugin actually works: `codeblocks()` registers Expressive Code plugins, a directive is stripped from `codeBlock.code` in `preprocessCode`, a Sätteri visitor finds the `{:lang}` suffix and highlights it with the site's theme, and interactive features mark their own blocks with a `data-scb-*` attribute for the shared client loader. `docs/e2e/inline-code.test.ts` updated for the new first inline code span (`codeblocks()`) and the new first paragraph's full text. README media regenerated (`pnpm readme:media inline-code-highlighting`); the README and package README's alt text updated to describe a quoted paragraph rather than a single sentence.
- Reason: The previous one-line example ("Call `await fetch(url){:js}`…") did not read as an example and was too short to show the feature's range across languages. The home page carousel keeps its own short one-line copy of the feature in `index.mdx` (a separate, hand-written slide, not generated from the docs page), so it needed no change and still fits at the shared slide height.
- Alternatives: Keep the carousel slide's content in sync with the longer example (would need `tall` on that slide; not asked for, and the short slide already fits the format of the other non-tall slides).

## Token transitions: Previous, Next and a step counter under the block

- Date: 2026-09-27
- Step: after the plan (docs polish, user request)
- Decision: `<CodeSteps>` no longer puts Previous and Next in the title bar. The title bar keeps only the numbered steps and the current step's label. `src/components/steps.ts` adds a `.scb-steps-controls` row as the last child of each step's `.expressive-code` wrapper (a sibling of `figure`, so it sits under the framed block, not inside its border): a Previous button, a "Step N of M" counter, and a Next button, styled as pills like the home page carousel's Previous/Next controls but built from Expressive Code and `codeblocks` style-setting CSS variables (`codeBackground`, `codeForeground`, `codeblocksTransitions.stepBorder`, `codeblocks.accent`), so it works on any site, not only the docs site's own CSS. Both `.scb-tools` (title bar) and `.scb-steps-controls` (under the block) still work through the existing `data-scb-steps-go` click delegation in `code-steps-client.ts`, unchanged. `swapInto()` (used when a full screen plugin copies a block) now also swaps `.scb-steps-controls`. `.scb-steps-controls` joined the `markDecorations()` list (Pagefind, `llms.txt`-style tools). Disabled state at the ends is unchanged (SPEC 7.5, no wrap). Hidden without JavaScript and under print, same as the old title-bar buttons. Unit and Playwright tests updated (the previous "2 Tabs to Previous" keyboard test now needs 3, because the copy button now sits in the tab order before the new row). README media regenerated for `token-transitions`. Docs page (Behaviour) and the accessibility reference page updated. The home page carousel's token-transitions slide (`docs/src/content/docs/index.mdx`) needed no change: measured its own natural (unstretched) content height at 304px against the tallest non-tall slide (annotations, 428px), so it still fits the shared card height with room to spare.
- Reason: User feedback: the title-bar Previous/Next were not obvious enough as a way to move between steps. A separate, larger, pill-styled row under the block reads as a distinct navigation control, matching a pattern the user had already approved for the carousel.
- Alternatives: Keep Previous/Next in the title bar but make them larger (still competes for space with the title, the numbered steps and the label, especially under 640 px). A single "Next" call to action with no visible "Previous" (loses symmetry and the step count the user did not ask to drop).

## Home page hero: a 3D render of the logo

- Date: 2026-09-27
- Step: after the plan (docs polish, user request)
- Decision: The home page hero image is `docs/src/assets/hero.png` (a glossy 3D render of the terminal-window-with-star mark, transparent background, supplied by the user), in place of `logo.svg`. Same alt text ("A terminal window with a star in it"). `logo.svg` stays as it is and keeps its other two jobs: the favicon build source is `docs/public/favicon.svg` (unrelated file, untouched), and `docs/src/pages/og/[...slug].ts` still reads `logo.svg` for the corner mark on share-card images. Starlight's hero `image.file` goes through `astro:assets`, so the build turns the 1134 kB PNG into a 22 kB WebP at display size, with no further work.
- Reason: The user supplied the 3D render and asked for it on the hero specifically, not everywhere the flat mark appears.
- Alternatives: Replace `logo.svg` everywhere (the user did not ask for that, and the flat mark still reads better small, in the header and as a favicon).

## Carousel slides synced to each feature page's first example, with an automated check

- Date: 2026-09-27
- Step: after the plan (user report: the carousel showed the old inline code highlighting example)
- Decision: Supersedes the carousel-slide part of "Inline code highlighting example: a blockquote that explains the plugin's own mechanics". Every `<Feature page="…">` slide in `docs/src/content/docs/index.mdx` now shows the exact Markdown of that page's first `<Example>` (its `export const` source, with the page's `hiddenAttributes` applied to the fence line, the same way `<Example>`'s own non-live render does), instead of a hand-written, independently maintained copy. Three slides had drifted from their page's current example (page content had moved on since the slide was written): `scrollycoding` (page since gained a `/health` route and two more steps), `side-by-side-annotations` (page since gained `sys`/`Path` imports and a `main()` function), and `code-switcher` (the slide showed a Python/JavaScript `sync="lang"` pair that was actually a trimmed copy of the page's *second* `<Example>`, not its first). `code-switcher`'s slide now duplicates the exact npm/pnpm/Yarn block also shown later on the same page under "Install" — accepted, because keeping the slide mechanically equal to the page's first example (rather than hand-picking a "nicer" second example per feature) is what makes the new automated check possible with no page-by-page special-casing; flagged for the user in case a different first example on that page is preferred instead. `fill-in-placeholders`'s slide gained the page's second (Python) block, since the feature's point is values syncing *across* blocks. `run-in-the-browser`'s slide swapped its JavaScript example for the page's actual Python/Pyodide one. `inline-code-highlighting`'s slide now shows the full two-paragraph blockquote (superseding the "kept short" decision below it) and is now `tall`: at desktop width it measured 412px, under the previous 428px tallest non-tall slide (annotations), so it first went in without `tall` — but at the phone width the carousel e2e suite tests against (360px), the blockquote's prose reflows into far more lines than any code block does, pushing the shared non-tall height from 794px to 883px there and breaking two `docs/e2e/carousel.test.ts` scroll-position assertions that assumed a short "Focus" slide's card fits the 780px-tall phone viewport untouched. Marked `tall` instead (matching the existing rationale for `scrollycoding`/`side-by-side-annotations`: a slide whose own content needs more room shouldn't inflate the shared budget every other slide is measured against), which returned the phone shared height to 593px and the desktop one to 478px (up from 428px, since `fill-in-placeholders`'s new second block is now the tallest of the remaining non-tall slides) and made the carousel e2e suite pass unchanged. `scripts/examples.test.mjs` gained a test that walks every `<Feature>` slide in `index.mdx`, finds that page's first `<Example>`, and asserts the slide equals its `export const` source (with `hiddenAttributes` applied and the MDX `\{:` escape undone) — so a page's example changing without its slide is now a `pnpm test` failure, not a silent drift. `unescapeTemplate` (shared with the existing `<Example>`-vs-source test) now also undoes `\t`, needed to compare `visible-whitespace`'s tab-in-a-template-literal source against the slide's real tab character.
- Reason: The user reported that the inline code highlighting carousel slide still showed the old one-line example after the page's own example became a longer blockquote (commit 7ba9f74), and asked for every slide to be audited against its page and for drift to be prevented, not just this one instance fixed.
- Alternatives: Import each page's `export const` directly into `index.mdx` and render it inside `<Feature>` (MDX can import named exports from a sibling `.mdx` file). Rejected: slides are not all `<Example>`-shaped strings rendered by one generic renderer — several (`scrollycoding`, `token-transitions`, `code-switcher`) are live MDX with real components (`<Scrollycoding>`, `<CodeSteps>`, the `:::code-switcher` directive) sitting directly in the slide's children, exactly as `<Example>` itself renders a live slot rather than parsing a string for those cases. Reusing that import at runtime would need a generic Markdown-to-JSX evaluator in `index.mdx` (an MDX runtime dependency the spec does not name, and more moving parts than a page in this docs site needs), where the test-based check reuses `scripts/examples.test.mjs`'s existing string-diff approach unchanged in shape, with no runtime cost and no new dependency.

## README feature samples: one manual fix, no automated check

- Date: 2026-09-27
- Step: after the plan (user report, extended to the README)
- Decision: `README.md`'s "Inline code highlighting" sample (and its copy in `packages/starlight-codeblocks/README.md`) now shows `` > `codeblocks(){:js}` in `astro.config.mjs` adds a set of Expressive Code plugins to the site. `` — the first sentence of the page's current blockquote example — in place of the old one-line `Call \`await fetch(url){:js}\` before you read the body.` sample. Its image (`.github/assets/readme/inline-code-highlighting.png`) and alt text had already been regenerated for the blockquote in commit 7ba9f74; only the hand-typed sample fence was missed. Checked the other 22 README feature sections against each page's first `<Example>` by hand: every other one is either an attribute-only "syntax skeleton" with an empty fenced body (e.g. `` ```py annotations="side"\n```  ``, deliberately dropping attributes like `title` that the real page example carries) or a short, legitimate excerpt of the same example (a subset of its lines, sometimes with a trimmed sentence, e.g. Scrollycoding's `<Step>` text). No automated check was added for the README. Unlike the carousel slides, README samples are not all "the page's first example verbatim plus one optional attribute list" — they mix whole-example excerpts, single trimmed lines/sentences and bare attribute skeletons with attributes the page version doesn't have, so a generic equality or subsequence check produces false positives on legitimate, intentional trimming without per-section special-casing (which a spot check confirmed while designing the check, before it was dropped).
- Reason: The user asked to check the README the same way as the carousel slides, and to extend the drift check to it "if practical". A one-time manual audit found exactly one real mismatch (the same inline code highlighting drift already found on the carousel); building bespoke per-shape comparison logic for a file that only changes when a feature's own example changes was judged disproportionate.
- Alternatives: A generic "every non-empty README code line is an ordered subsequence of the page's first example" check (tried in analysis): fails on `code-switcher`'s README sample, which drops the *last* of three variants (README ends `` ``` `` / `:::` immediately after the pnpm block, but the page's source has a whole Yarn block between them, so the trailing lines aren't contiguous) and on Scrollycoding's `<Step>` text (a prefix of a sentence inside an XML tag is not a line prefix or an exact line match). Handling both would need per-content-shape logic (nested fences vs `<Step>` prose vs bare attribute skeletons), which is what this decision rejects as disproportionate; a periodic manual audit alongside any feature-example change is the recommended alternative.

## Agent skill: root `skills/starlight-codeblocks/`, copied into the package at pack time

- Date: 2026-09-27
- Step: after the plan (user request: bundled agent skill)
- Decision: The skill lives at `skills/starlight-codeblocks/` in the repository root: a `SKILL.md` of about 180 lines (set-up, a decision guide from goal to feature for each sidebar group, the syntax rules, the features that start on their own, gotchas) and one `references/<group>.md` file for each sidebar group, with the per-feature detail (what it is for, when not to use it, attributes, directives, options, an example, limits, the docs link). The main install route is `npx skills add ewels/starlight-codeblocks`. The npm package also ships the skill at `skills/starlight-codeblocks/`: a `prepack` script copies the root folder into the package (the copy is gitignored), and `files` lists `skills`. The docs and README never name the `node_modules` path. The docs page `guides/agent-skill` renders every skill file with `?raw` imports, so it cannot drift. `packages/starlight-codeblocks/test/skill.test.ts` fails if a feature page, an attribute form, a directive or an option key from the package's reference data is missing from the skill, and checks the front matter against the Agent Skills spec. `pnpm lint:docs` now also checks `skills/`, because the skill follows `WRITING-STYLE.md`.
- Reason: The `skills` CLI (vercel-labs/skills 1.7.0, README "Skill Discovery" and the `discoverNodeModuleSkills` source) looks first in a root `SKILL.md`, root `skills/` and agent folders such as `.claude/skills/`, and does a recursive search only when those have nothing. Tested with the CLI in the scratchpad: with the skill at the root, `npx skills add <repo> --list` finds one skill. With the skill only inside `packages/starlight-codeblocks/` (the layout of starlight-pydocs PR 4), the recursive search also finds the copy of the starlight-docs skill in `design/reference/`, so the install offers two skills. The CLI's `experimental_sync`, and antfu/skills-npm, find package skills at `node_modules/<pkg>/skills/<name>/SKILL.md`, which the packed layout matches (tested: `experimental_sync` finds and links it). The Agent Skills spec (agentskills.io/specification) asks for `name` equal to the folder name, a `description` of 1024 characters or fewer that says when to use the skill, a `SKILL.md` under 500 lines and about 5000 tokens, and detail in `references/` one level deep. Claude Code's skills docs give the same 500-line limit.
- Alternatives: The skill inside the package folder only (the install then offers the unrelated starlight-docs skill, and root discovery misses it). A symlink from the package to the root folder (npm pack does not follow symlinks reliably, and a Windows clone can break it). A committed second copy in the package (can drift). One large `SKILL.md` with every feature (over the recommended size, and an agent loads all of it for every task).

## Expandable bar inside the frame; hidden lines' no-JS toggle and first rule

- Date: 2026-09-27
- Step: after the plan (mockup review follow-up, group C)
- Decision: The expandable "Show all" bar now continues Expressive Code's frame: `codeBackground`, the frame's `borderWidth`/`borderColor` on its sides and bottom, and EC's own bottom radius (`borderRadius + borderWidth`). The `pre`'s bottom border is the only divider, and its bottom corners go square only while the bar shows (`screen and (scripting: enabled)`, so print and no-JS keep EC's rounded frame). This is the same pattern as the runnable output panel and the footnote list. While collapsed, `code` drops its bottom padding, so the cut and the 3.6em fade fall on the lines (about 2.2 lines faded, as in the mockup). Hidden lines: the title bar "Show N hidden lines" button is hidden under `scripting: none`; the markers stay (SPEC 6.7 "the markers do nothing"). The first marker's dashed rule now runs to the end like the others; the copy button covers it on hover, as in the mockup. Only on `hover: none` screens, where EC always shows the copy button, does the rule stop short of it.
- Reason: The review found the bar floating on the page background with a double rule, a shorter fade than the mockup, a dead toggle without JavaScript and a 40px gap at the end of the first rule at rest. Every value comes from EC's CSS variables, so the fix follows any EC theme and does not restyle EC.
- Alternatives: Move the rule's end on hover (it jumps as the pointer enters). Keep the gap everywhere (the reported bug).
- Addendum (2026-09-28, re-review): The mockup gives every code area `tabindex="0"`, including a collapsed block. The collapsed `pre` does not get one. Expressive Code gives a `pre` `tabindex="0"` only when its lines scroll sideways, so that a keyboard user can scroll them, and it does the same for a collapsed block. A collapsed block does not scroll down: it cuts the lines, and the "Show all" button, which takes focus, opens them. A tab stop that does nothing would add one key press for each block.

## Scrollycoding: steps activate at the middle of the sticky block

- Date: 2026-09-27
- Step: after the plan (mockup review follow-up)
- Decision: A step is active while it crosses the middle of the sticky block, not the middle of the window. `scrolly-client.ts` measures the sticky copy (its `top` and height, with a `ResizeObserver` and on window resize), sets an `IntersectionObserver` with a 1 px band at that line, and writes `--scb-scrolly-line`, `--scb-scrolly-lead` and `--scb-scrolly-height` on the root. Each step is a slot of `min(30vh, 0.6 × block height)` with its text centred in it, so the active text stays inside the block's height (checked from 1280×720 to 1920×1200). The steps column gets leading padding so that the first step starts at the middle of the block when the block sticks, and trailing padding of at least 20vh, enough for the last step to reach the middle. If the block is taller than the window, the line is the middle of the visible part. The narrow and no-JS layouts are unchanged.
- Reason: The mockup scrolls in its own box, so its middle is the block's middle. On a Starlight page the block sticks at the top, and with the band in the middle of the window the active text sat 35 to 90 px below the block. A slot of 30vh alone is taller than a typical block on a tall window, so the active text scrolled above the block before the next step took over. The design pack said "middle of the viewport"; this keeps its intent (active text level with the block).
- Alternatives: A scroll listener that picks the step nearest the line (more code, runs on every scroll). The old 30vh steps with the text at the top of each step (the text left the block's height at 1920×1080 and more).

## Token transitions: label hidden below 480 px, and magic-move's phase delays

- Date: 2026-09-27
- Step: after the plan (mockup review follow-up)
- Decision: The step label hides only below a 480 px container width, not 640 px, and it ends with an ellipsis if the title bar is too short for it. The plugin CSS sets `--smm-stagger: 0ms` on the animated tokens (`.scb-steps-anim > *`).
- Reason: Starlight's content column is 632 px at 1280 px and about 690 px at 1024 px, so the 640 px query hid the label at common desktop widths; the mockup shows it next to the steps. At 480 px and more, the example's title, three steps and label fit. magic-move's renderer sets a unitless `--smm-stagger: 0` on its container, so `calc(<time> + 0)` in its own delay rules was invalid and every phase started at 0 s. With a unit, moves start at 0.3 and enters at 0.7 of the duration, as magic-move intends. The rule on the tokens wins over the inherited value without `!important`, and it does not affect a real stagger, which magic-move sets inline on each token.
- Alternatives: Measure the title bar in the client to hide the label (more code for what an ellipsis already handles). Patch or fork magic-move (a dependency change for a one-line CSS fix).

## Popovers, hover cards, callouts and footnote lists follow the mockup's placement and plugin-owned details

- Date: 2026-09-27
- Step: mockup review follow-up (annotations, API auto-linking, inline callouts, footnotes)
- Decision: `scb-float` elements have a fixed width of `min(popoverMaxWidth, 100vw - 24px)` (hover cards 20px wider, through `--scb-float-width`). They are centred under the anchor with `position-area: block-end` and `justify-self: anchor-center`, with an 8px gap and 12px inline margins, so that anchor positioning shifts them to stay 12px inside the viewport, and they flip above with `flip-block`. The `place()` fallback does the same sums as the mockup. The callout arrow moves from the callout row to the bubble (`.scb-callout-bubble::after`) and is clamped to 10px inside the bubble, so it can never point past the bubble's end. The bubble keeps the code font size so that `1ch` in the arrow position is the code's; its text is in a new `.scb-callout-text` span with the callout font size. The row has the mockup's 18px end padding. `--scb-callout-len` now counts the text that readers see (not the Markdown backticks and link URLs), plus one character for each inline code chip. Inline code in annotation popovers and footnote lists uses `codeFontFamily`, and a `.frame` selector keeps its 3px radius against Expressive Code's square top corners in titled blocks. Footnote list code has `box-decoration-break: clone`. The sticky footnote list has a top border that overlaps the bottom border of the code (`margin-top: -borderWidth`), so it shows when the list floats and does not double at rest.
- Reason: The mockup review found popovers left-aligned to their marker and overhanging, cards touching the phone edge, a callout arrow off its bubble at 360px, bubbles shifted left by an over-long text estimate, and plugin-owned inline code in a generic font. These are plugin UI, not Expressive Code styling, so they follow the mockup. With the 18px end padding, the first docs callout at 1280px is about 15px further left than 40px, because the site's callout font is larger than the mockup's and the bubble does not fit there at 40px.
- Alternatives: Clamp the arrow on the row against an estimated bubble width (breaks when the text wraps). A registered `@property` length for the arrow offset (Expressive Code nests plugin styles, so the at-rule would be invalid). Keep `max-content` popover widths (the recorded choice before, but it does not match the mockup).

## Mockup polish of the plugin's own title bar controls and labels (group E)

- Date: 2026-09-27
- Step: after the plan (mockup review follow-up)
- Decision: Only the plugin's own UI changes; Expressive Code's styling stays. (1) `.scb-btn` gets the stronger fill on `:hover` only; keyboard focus shows only the 2px ring, as in the mockup. (2) A focused line permalink keeps its inset ring (the `pre` clips a ring outside the gutter) but its box runs 0.75ch into the code padding, so the ring clears the right-aligned digits; the digits do not move. (3) The forced title bar on untitled blocks takes the height of Expressive Code's editor tab bar from EC's own variables (`uiFontSize × uiLineHeight + 2 × (uiPaddingBlock + frames.editorActiveTabIndicatorHeight) + borderWidth`), 34.8px with Starlight's defaults, the same as a titled block, and `--button-spacing` uses EC's titled formula. The mockup's 36px is not used, because untitled and titled blocks must match. (4) Title bar controls sit centred on the whole bar: the forced bar's top border no longer pushes them 1px down, and in a terminal frame they centre between the top edge and the line under the bar. (5) Line state labels: `vertical-align: 0.09em` centres them on the line (was 0.45px low), and the name keeps its literal space (for reading without styles, and for the text content that tests and screen readers see) with `margin-inline-end: calc(6px - 1ch)`, which gives the mockup's 6px gap in the monospace code font. (6) The focusable `code` of a focus block gets `aria-label="Code: <title>"`, or "Code block" without a title, as in the mockup; scrollycoding's focusable code gets "Code block". (7) Run output: 12.5px (0.78125rem) / 1.65, padding 9px 16px, the mockup values. (8) Docs examples: the code switcher's npm/pnpm/Yarn example (and its carousel slide) sets `frame="code"` on each variant, so it renders in the editor frame like the other switcher examples instead of EC's automatic terminal frame; the colourised brackets example splits the long call over three lines (and uses `kebab` for `kebabCase`) so it fits at 1280 and at 360px; the code mentions example drops `title="factorial.py"`, as in the mockup.
- Reason: Mockup review reports for open in playground, run in the browser, code switcher, line permalinks, line states, focus, colourised brackets and code mentions. `frame="code"` is visible in "You write" on purpose: a reader who copies the example without it gets the terminal frame.
- Alternatives: Changing EC's frame logic for untitled `sh` blocks (rejected: EC styling stays). A title on each package manager variant (adds a tab the mockup does not have). A positive outline offset on permalinks (clipped by the `pre` at the left edge). Removing the literal space in state labels (text content would read "ErrorSyntaxError").

## Keep Expressive Code's default styling

- Date: 2026-09-27
- Step: after the plan (mockup review follow-up, user decision)
- Decision: The plugin never restyles what Expressive Code draws itself: the frame and title bar, the fonts, the copy button, and the tints, bars and `+`/`-` indicators of text markers (`mark`, `ins`, `del`). The mockup differs from Expressive Code's defaults in several of these (for example weaker `ins`/`del` line tints and a 3px line bar), and those differences stay. Only the plugin's own UI (its controls, glyphs, word tints, popovers) follows the mockup.
- Reason: The user decided: "the plugin shouldn't change any styling — sticking with Expressive Code is the right thing to do." A site then looks the same with and without the plugin in every block that uses no plugin feature, and a site's own Expressive Code style settings keep working.
- Alternatives: Override Expressive Code's text-marker style settings to match the mockup (changes every diff block on the site, including blocks that use no plugin feature, and fights the site's own settings).

## Runtime dependency: `hast-util-from-html`

- Date: 2026-09-27
- Step: after the plan (mockup review follow-up, missing entry)
- Decision: The package depends on `hast-util-from-html` (^2.0.3) at run time. `<CodeSteps>` (`src/components/steps.ts`) and `<Scrollycoding>` (`src/components/scrolly.ts`) use it to parse the HTML that Expressive Code rendered for their slot, so that they can read the tokens of each step. The remark adapter (`src/satteri/remark.ts`) uses it to turn the raw HTML that a Sätteri visitor returns into a hast node that remark-rehype renders on `unified()` sites.
- Reason: The spec does not name it. It is the unified collective's HTML-to-hast parser (parse5 underneath), the same tree format that Expressive Code's `@expressive-code/core/hast` uses, and it is already in every Astro site's dependency tree. A hand-written HTML parser would be less correct for the same job.
- Alternatives: `parse5` directly (needs a second conversion to hast). Regular expressions over the HTML (breaks on nested elements and attributes that contain `>`).

## Word-level diff: lower word tints in dark themes

- Date: 2026-09-27
- Step: after the plan (mockup review follow-up)
- Decision: Supersedes the word-tint alphas in "Code text on plugin tints". In dark themes the tint of added words is `ins` at 15% opacity and the tint of removed words is `del` at 18% (was 36% and 40%, the mockup's values). Light themes keep 30%. `ensureTextContrast` still corrects any colour that fails 4.5:1 on the stacked tints. `test/tints.test.ts` checks that the correction keeps at least half the chroma of each coloured syntax token, so that changed words keep their syntax colours (SPEC 6.9).
- Reason: The mockup's word tints sit on a 15% line tint. Expressive Code's own `ins`/`del` line tints are much stronger, and the plugin keeps them (see "Keep Expressive Code's default styling"). On the stacked tints, 4.5:1 needs near-white text, so every changed word lost its syntax colour in dark themes. At 15% and 18%, the colours that still fail move only a little and keep their hue. The underline and the line-through carry the meaning, so the weaker tint loses no information.
- Alternatives: Skip the contrast correction on changed words (fails WCAG 1.4.3). A word tint with the same luminance as the line tint (keeps every colour, but the words are then almost impossible to tell from the line).

## Visible whitespace: put trailing whitespace back

- Date: 2026-09-27
- Step: after the plan (mockup review follow-up)
- Decision: Expressive Code trims the end of every line in the `ExpressiveCodeBlock` constructor, before any plugin hook runs. For a block with `whitespace="all"`, the Markdown plugin (Sätteri, and remark through the adapter) records the trailing whitespace of each line in a hidden `scbTrailing` fence attribute (URI-encoded JSON, line numbers counted from the first non-blank line, as Expressive Code drops the blank lines before it). The whitespace plugin keeps the block's lines as written in `preprocessMetadata` and appends the whitespace to the same line objects in `preprocessCode`, so the mapping holds after comment notation removes directive lines. The copy button then copies the trailing whitespace too. The default, leading-only mode records nothing. A block that `<Code>` renders gets no Markdown pass, so it shows no trailing whitespace; the docs page says so under Limitations, and its trailing-whitespace example is a live Markdown slot.
- Reason: The docs promised trailing whitespace with `whitespace="all"`, and it could never show. The fence meta is the only channel from the Markdown tree to Expressive Code that survives the trim, and the code switcher already uses it the same way (`scbSwitcher`).
- Alternatives: Patch Expressive Code's constructor (patches a dependency). A sentinel character at the end of each line (comment notation parses directives before a plugin can edit the code, so a sentinel breaks directives at the end of a line). Remove the claim from the docs (the user prefers working features over documented limits).

## Visible whitespace: fainter glyphs from the code foreground

- Date: 2026-09-28
- Step: after the plan (mockup choices, user decision A)
- Decision: The glyphs use a new style setting, `codeblocksWhitespace.foreground`, which is the code foreground of the theme (`codeForeground`) at 32% opacity in dark themes and 38% in light themes. Before, they used `codeblocks.mutedForeground`, the colour of secondary text. On the Night Owl and GitHub themes the glyphs have about 2:1 to 2.5:1 contrast on the code background (the mockup's `#4f5b73` on `#1b1f2c` is 2.4:1), less than half the contrast of muted text. A unit test checks that range in each theme, and a Playwright test checks that the glyph colour is the code colour with an alpha between 0.25 and 0.45.
- Reason: The user chose the mockup's fainter glyphs, and asked for colours from the theme instead of fixed hex values, so that other Expressive Code themes and both colour schemes still work. A colour with alpha also stays faint on tinted lines (marked, inserted or focused lines). The glyphs are `aria-hidden` decoration and carry no meaning of their own, so they have no contrast target.
- Alternatives: Keep `codeblocks.mutedForeground` (the user chose the mockup). The mockup hex values (do not follow other themes). The same alpha in both schemes (light glyphs at 32% look weaker than dark ones at the same alpha).

## Token transitions: new lines flash the theme's green

- Date: 2026-09-28
- Step: after the plan (mockup choices, user decision A)
- Decision: A line that is new in a step, compared by text with the step before (a line that appears twice must appear twice before, and blank lines never count), gets a tint that starts at `codeblocksTransitions.newLineBackground` and fades out over `codeblocksTransitions.newLineDuration` (1000 ms, ease-out), through half of the tint at 55%, as in the mockup. The tint is the theme's `terminal.ansiGreen` colour at 30% opacity. During the magic-move animation the tints are absolutely positioned rows (`1lh` high) in the animation box, next to the magic-move container, because magic-move replaces the children of its container. When the animation ends, the real `.ec-line` elements take over the same CSS animation with a negative `animation-delay`, so the fade continues without a jump, and they drop the class on `animationend` or `animationcancel` (hiding a step cancels it, and it would otherwise play again when the step shows). The mockup's fade of the text from 0 to 1 is left out, because magic-move already fades in new tokens. Under reduced motion there is no animation and no tint. `<Scrollycoding>` does not animate tokens, so it gets no tint.
- Reason: The user chose the mockup's flash and asked for colours from the theme. Every theme defines `terminal.ansiGreen` (Expressive Code fills in a default otherwise), and it is green in every theme checked: Night Owl dark and light, GitHub dark and light, Dracula, One Dark Pro, Solarized Light, Catppuccin Latte, Min Light, Vitesse Dark and Nord. Expressive Code's own `textMarkers.insBorderColor` is one fixed LCH green for every theme, so it does not follow the theme.
- Alternatives: `editorGutter.addedBackground` (teal in Night Owl Light, and missing in some themes). `diffEditor.insertedTextBackground` (already transparent, and blue in Nord and One Dark Pro). Start the tint only when the real code shows again (a 500 ms delay, and the peak of the tint would be lost).

## Hidden lines: dimmed open lines and rule feedback

- Date: 2026-09-28
- Step: after the plan (mockup choices, user decision A)
- Decision: Supersedes the colours in "Hidden lines" above, which used `color-mix()` with no settings. The `codeblocksHiddenLines` group gets five settings. `openBackground` is `codeForeground` at 4% opacity (the tint of lines that show, as before) and `openOpacity` is `0.75`, which the `.code` element of a hidden line that shows gets, as in the mockup. The code, the tint and any decoration on the line dim together. The dashed rule is `rule` (`codeblocks.mutedForeground` at 35%, as before), `ruleHover` under the pointer (the full muted colour, as in the mockup) and `ruleOpen` while its run shows (22%, the mockup's ratio between its open and rest colours). While a run shows, the open colour also wins under the pointer, as in the mockup; the marker text still brightens.
- Reason: The user chose the mockup for both. The user was told that dimming lowers the contrast of syntax colours and chose it knowingly. Measured at 0.75 opacity on the tint: every theme checked has syntax colours under 4.5:1, because Expressive Code corrects token colours only to 4.5:1 and many sit right at that limit. The lowest are 3.42:1 (Night Owl dark), 3.15:1 (Night Owl Light), 3.44:1 (GitHub dark), 3.10:1 (GitHub light), 3.42:1 (Dracula), 3.17:1 (Solarized Light) and 3.12:1 (Min Light). One Dark Pro's plain code colour falls to 4.16:1. A unit test keeps every colour at 3:1 or more, and the accessibility page says so, with `openOpacity: '1'` to turn the dimming off.
- Alternatives: Keep full opacity (the user chose the mockup). Dim to a level that keeps 4.5:1 (no such level exists for colours that are already at 4.5:1).

## Hover colour: the accent moved towards the code foreground

- Date: 2026-09-28
- Step: after the plan (mockup choices, user decision A)
- Decision: A new shared setting, `codeblocks.accentHover`, is `codeblocks.accent` mixed 45% towards `codeForeground` (`hoverColour()` in `styles.ts`). In dark themes it is lighter than the accent (Night Owl: `#a8c1f6`, close to the mockup's `#a9c3ff`); in light themes it is darker, so it stays visible on a light background. Every numbered step of `<CodeSteps>` takes it as its border under the pointer, including done steps and the current step (before, only steps that were not done changed). Annotation markers get `codeblocksAnnotations.markerHoverBackground`, `markerBackground` mixed the same way, for hover, keyboard focus and an open note, with no 150 ms fade. Side-by-side line markers take the same hover colour (before, they kept their colour). Unit tests check, for each theme, 3:1 on the code background, 4.5:1 for the marker number on the hover colour, and that the colour moves towards the text.
- Reason: The user chose the mockup and asked that it work with other Expressive Code themes and light mode. A mix towards the theme's own text colour gives the mockup's lighter blue on dark themes and a visible change on light themes, and it follows a site's own `accent` or `markerBackground`.
- Alternatives: `lighten()` (lightens in light themes too, which lowers contrast with the white number and with a light background). A second hex pair (does not follow other themes).

## Code mentions: links keep their colour on hover

- Date: 2026-09-28
- Step: after the plan (mockup choices, user decision A)
- Decision: The style that the mentions module adds to the page gives `a[href^="#mention:"]` the colour `var(--sl-color-text-accent, revert-layer)` on hover and focus, so Starlight's `.sl-markdown-content a:hover` colour (white or black) does not apply. The underline still turns from dotted to solid. Other links on the page keep Starlight's hover colour (Playwright checks both).
- Reason: The user chose the mockup, where only the underline changes. The module's style is not in a cascade layer, so it wins over Starlight's layered style with no extra specificity. `revert-layer` keeps a site without Starlight's variables on its own layered link colour.
- Alternatives: `color: inherit` (the prose colour, not the link colour). A higher-specificity selector against Starlight's (fragile, and not needed across layers).

## Footnotes: the numbers line up with the code

- Date: 2026-09-28
- Step: after the plan (mockup choices, user decision B with a change)
- Decision: The footnote list keeps its 24 px number links and row spacing, but its start padding is now `max(0px, codePaddingInline + 2ch - max(2.5ch, 24px))`, so the digit of a one-digit number ("1.") starts level with the code text. The gap between the number and its note is `1ch` (was `0.6ch`). On the docs site the note text starts about 39 px from the frame edge (was about 47 px; the mockup has 42 px). A Playwright test checks the alignment and the gap for the static and the sticky list.
- Reason: The user kept the layout but found the left padding excessive. Lining the numbers up with the code gives the list a reason for its indent, instead of a fixed padding.
- Alternatives: The mockup's fixed 42 px padding (does not follow `codePaddingInline`). Smaller number links (the user kept the 24 px targets).

## Mockup choices kept as built

- Date: 2026-09-28
- Step: after the plan (mockup choices, user decision B)
- Decision: The user compared the build with the mockup and kept the build for the colourised brackets hover outline, the Run button, token link underlines, the line tint strengths, and the look of popovers and API hover cards. Nothing changes for these.
- Reason: The user's decision.
- Alternatives: The mockup's versions.

## Colours come from the Expressive Code theme

- Date: 2026-09-28
- Step: after the plan (mockup re-review)
- Decision: Supersedes the fixed `[dark, light]` colour pairs of "Style settings: one shared group, one group for each feature" and of the built-in line states. Every colour default is now a resolver that starts from a colour of the Expressive Code theme and then goes through `ensureColorContrastOnBackground()` to its contrast target on the code background of that theme (`onCode()` and `themeColour()` in `styles.ts`). `themeColour()` reads `theme.colors`, where Expressive Code fills in the VS Code default for a colour that a theme leaves out, and falls back to the theme foreground. The sources: `codeblocks.accent` from `terminal.ansiBlue` (4.5:1, so that the code background has 4.5:1 on it as `accentForeground`); `mutedForeground` is `codeForeground` mixed 30% towards the code background (4.5:1 on the code and on the popover); `popoverBackground` is the code background mixed 12% towards the accent in dark themes, and lightened (white in practice) in light themes; `popoverForeground` is `codeForeground`; `popoverBorder` is the popover mixed 30% towards the accent. Features: API link underline and step border from mixes of the code colours (3:1); permalink target from `terminal.ansiYellow` (3:1); footnotes from `terminal.ansiMagenta`; Run output and errors from `terminal.ansiGreen` and `terminal.ansiRed` (4.5:1); word-level diff tints from the same green and red; shell prompts from `terminal.ansiCyan`; brackets from `editorBracketHighlight.foreground1` to `3`, or VS Code's own defaults for these colours (what VS Code shows for a theme without them) when the theme has none (terminal colours would equal syntax colours in Night Owl, so brackets would look like keywords); the built-in line states from `editorError.foreground`, `editorWarning.foreground` and `editorInfo.foreground` (3:1). Custom line states keep their `colour: { dark, light }` option. Night Owl, the docs site's theme, keeps its accent (`#82aaff`) and footnote purple (`#c792ea`) exactly. To keep 4.5:1 for every syntax colour with the new, darker hues, the permalink target tint in dark themes drops from 8% to 6%, the footnote line tint in light themes from 12% to 10%, and inline code in the footnote list from a 12% to a 10% chip. The shared unit test themes now include Dracula, Solarized Light, One Dark Pro, Catppuccin Latte, Nord and Min Light, and every contrast test measures against the code background of its own theme. The style settings reference says where each default comes from.
- Reason: The user asked for theme tokens instead of custom hex values, so that other Expressive Code themes and both colour schemes still work. Fixed pairs were tuned for two backgrounds; on Solarized Light or Dracula they gave colours foreign to the theme, and their contrast was checked only on the default backgrounds. A theme colour with contrast correction keeps the theme's own palette and a guaranteed contrast on any background.
- Alternatives: Keep fixed pairs (the reported problem). `textLink.foreground` or `focusBorder` for the accent (most themes leave them at the VS Code default or use a dark border colour, such as Night Owl's `#122d42`). `editorHoverWidget.background` for popovers (much darker than the code in Night Owl, and brown in Solarized Light). Leave the line states on fixed pairs (they would not follow the theme). Min Light's terminal blue is grey, so its accent is grey; that is the theme's own choice, and colour is never the only mark.

## Title bar controls: one rule without JavaScript, the menu, the end gap

- Date: 2026-09-28
- Step: after the plan (mockup re-review)
- Decision: A control that needs JavaScript (the code switcher menu, the Run button, the hidden lines button) gets `scb-needs-js`. One shared rule under `@media (scripting: none)` hides these controls, and hides the minimal title bar of an untitled block when every control in it has the class and the block has no steps. This replaces the per-feature rules of the code switcher and the Run button, and also fixes the empty bar of an untitled hidden lines block. The code switcher menu keeps its background under the pointer, as the mockup's `select`, instead of the shared `scb-btn` hover fill. In the minimal bar, the controls' end padding is `8px - borderWidth`, because the bar draws its own side border; the menu is 8px from the frame edge in titled and untitled blocks. The `scb-btn` border is 14% of the code foreground, the mockup's `.tool` value (was 16%).
- Reason: The re-review found the empty bar without JavaScript, the hover fill and a 9px gap. One class keeps the rule in one place for every future control.
- Alternatives: A third per-feature rule for hidden lines (repeats the same selector). `:only-child` rules (fail when two JS-only controls share a bar).

## Re-review of the mockup: smaller fixes and choices

- Date: 2026-09-28
- Step: after the plan (mockup re-review)
- Decision: Code mention links get a 2px `currentColor` focus ring with a 2px offset, as the mockup's accent ring (the link colour is the accent). Inline code with `{:lang}` gets 4px corners and `box-decoration-break: clone`, so a chip that wraps keeps its padding and corners on each line. Code in inline callout bubbles uses the code font and the `.frame` selector, the same as annotations and footnotes. Footnote badges change colour at once, with no 150 ms fade. The docs `<Example>` source pane keeps trailing whitespace (`keepTrailingWhitespace()`, the `scbTrailing` attribute without the `whitespace="all"` check), so that readers who copy the source of the visible whitespace example keep its trailing space. The code switcher's language example has a Rust variant, as the mockup. Choices kept: the annotations example uses `actions/checkout@v7`, the current version (the mockup has `@v5`). The sticky footnote list keeps the colour of the plugin's minimal title bar (`codeForeground` at 5% on the code background) instead of Expressive Code's tab bar colour, because Expressive Code uses a different colour for editor and terminal frames and Starlight sets it to the page background, where the list would not stand out. The chip in callout bubbles stays at `currentColor` 12% (the mockup has white at 8%; the difference is too small to see, and `currentColor` follows light themes).
- Reason: The re-review of the mockup listed these differences.
- Alternatives: A focus ring in `codeblocks.focusRing` (the prose link is outside the code blocks, where that variable is not defined).

## Token transitions: mockup timing, and the flash starts as new tokens enter

- Date: 2026-09-28
- Step: after the plan (mockup re-review)
- Decision: The move takes 480 ms with `cubic-bezier(.2, .7, .2, 1)`, the mockup's values (`codeblocksTransitions.duration` is now `480ms`, was 500 ms with `ease`). magic-move's container animation is off, so the block's height and the Previous and Next row change at once, as in the mockup. The tint of a new line starts when magic-move enters the new tokens (70% of the duration, 336 ms), with `animation-fill-mode: backwards`, so the full tint shows until the tokens enter and then fades; the real lines take over with the same offset.
- Reason: The re-review found the flash at its peak before the new text appeared, and the Previous and Next row sliding for about 300 ms. In the mockup the tint and the text start together.
- Alternatives: Start the tint at the click (the reported problem). Keep the height animation (the mockup changes it at once).

## Scrollycoding: the step nearest the line, and less padding after the last step

- Date: 2026-09-28
- Step: after the plan (mockup re-review)
- Decision: Supersedes the `IntersectionObserver` in "Scrollycoding: steps activate at the middle of the sticky block". A passive scroll listener, throttled to one animation frame, picks the step that contains the activation line, or else the nearest step, so the first or the last step when the line is outside all of them. The trailing padding of the steps column is `block height - lead - slot / 2`, just enough for the last step's middle to reach the line while the block is still stuck.
- Reason: The 1 px band fired only when a step crossed it, so a jump (the End key, an anchor, `scrollTo()`, a fast fling) left the wrong step active. The old padding of at least 20vh left about 400 px of scrolling with the block stuck alone and no step text beside it.
- Alternatives: Keep the observer and add a check on `scrollend` (two mechanisms for one job).

