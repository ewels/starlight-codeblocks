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
