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
- Decision: `addTitleBarControl()` in `core.ts` puts every title bar control in one `span.scb-tools` at the end of the header, 8px from the edge, with a 6px gap, as the mockup's `.tools`. In terminal frames the group is absolutely placed at the end, because the terminal header centres its title. The rule that gives a block with no title a minimal title bar moved from hidden lines to the shared styles and now keys on `.scb-tools`. The shared `scb-btn` style now uses the mockup's `.tool` values: the code foreground colour, a 16% foreground border, a 6% background (13% on hover) and 3px 8px padding. A playground link or form gets a `scb-sr-only` " (opens in a new tab)". The playground gets the text in the copy button's `data-code` (falling back to the code when a site turns the copy button off), so it sees the same text as the copy button, after shell copy and the other features. An unknown `playground` name warns and renders no button. A custom playground with a built-in name replaces the built-in one.
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
