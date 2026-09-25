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
- Decision: `<CodeSteps>` (from `starlight-codeblocks/components`, shipped as source in `src/components/`, so the package now publishes `src` next to `dist`) reads its blocks from `Astro.slots.render()`. `pluginTransitions()` adds `span.scb-steps-head > span.scb-steps-label` after the title for a `step="…"` attribute, and holds the styles. The component then adds, at build time, the numbered steps (`button.scb-steps-dot` with `aria-current="step"` and the name "Step N: label") and the Previous and Next buttons (`scb-btn`, in `.scb-tools`) to every title bar, keys the tokens with `@shikijs/magic-move/core` (each step synced to the one before, so tokens that never change keep one key), and writes them as `[key, text, style]` arrays in a JSON script. The client (`code-steps-client.ts`, about 2.7 kB gzipped with the renderer) moves the `scb-steps-current` class, and animates in a `div.scb-steps-anim` that replaces the new block's `code` element until the animation ends; the real block then shows again. Each token names its own colour (`color: var(--N)`), with N from a `codeblocksTransitions.themeIndex` style setting, because Expressive Code's token colour rule needs an unclassed span inside `.ec-line`. `@media (scripting: enabled)` hides every block but the current one, so the page does not jump when the script starts. Below a 480 px container width, Previous and Next show as `‹` and `›`, with the words as their accessible names. The step border is `#6b7894`, not the mockup `#5d6a85`, which is under 3:1 on the dark code background. A screen reader live region (Starlight's `sr-only`) announces the new step.
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
