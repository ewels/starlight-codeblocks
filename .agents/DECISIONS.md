# Decisions

The choices that the code does not explain, with the options that were rejected. Search here before you change behaviour. Add new entries in the right section, in this form: **Choice.** Why. *Rejected:* alternatives, and why.

## Principles

- **Keep Expressive Code's own styling.** The plugin never restyles the frame, title bar, fonts, copy button or text markers (`mark`, `ins`, `del`). A block that uses no feature looks the same with or without the plugin, and the site's own EC settings keep working. *Rejected:* matching the mockup's weaker diff tints (changes every diff block on the site).
- **Colours come from the EC theme.** Every default starts from a theme colour (`terminal.ansiBlue` for the accent, `editorError.foreground` for errors and so on) and is corrected to its contrast target on that theme's code background. *Rejected:* fixed `[dark, light]` hex pairs (foreign colours and no contrast guarantee on themes such as Dracula or Solarized).
- **Working features over documented limits.** When a feature breaks in a combination (full screen copies, collapsible sections, `unified()`, Starlight tabs), fix it rather than list it as a limit.
- **A wrong link is worse than none.** API auto-linking links only names it is certain about.
- **Bad input warns, it does not fail.** An unknown directive or attribute value warns and stays in the code as written, so the author sees the typo and one page cannot stop the site build. Only malformed ranges and invalid component content fail.
- **Ranges count the lines that readers see**, from 1: lines that hold only directives, the frames file name comment and lines that other plugins delete do not count, and `startLineNumber` does not shift them, as in EC's own ranges.
- **UI strings are English only.** Translation is out of scope for the first release. Starlight's i18n strings are the likely route later.
- **Ids are deterministic**: an 8-character SHA-1 of the file path, meta and code, plus a count for identical blocks, so builds are reproducible. *Rejected:* random ids, or a global counter (changes when a block above is added).

## Registration and build

- **Automatic registration with hidden plugin properties and an ec-config override.** It keeps the one-line set-up and makes `<Code>` work. When `ec.config.mjs` has `plugins`, the author adds `pluginCodeblocks()` and the build fails until they do. *Rejected:* always requiring `ec.config.mjs`; wrapping astro-expressive-code's hooks or Node loader hooks (fragile).
- **All options go to `codeblocks()`** on Starlight sites, also when the preset is in `ec.config.mjs`; the preset reads them from the registry.
- **`codeblocks()` sets `tabWidth: 0`** unless the Starlight config or `ec.config.mjs` sets it, including when `ec.config.mjs` has plugins. Otherwise real tabs never reach visible whitespace or the copied text, with no warning.
- **Collapsible sections must come before `pluginCodeblocks()`.** The notation plugin throws otherwise, because our decorations shift the children that the other plugin picks by position. *Rejected:* moving every decoration to `postprocessRenderedBlockGroup` (touches most features for one optional plugin).
- **The preset takes `{ base }`** for sites without Starlight, so site-relative `[!link]` URLs and adapter hrefs get the base.
- **The registry is a public contract** for other plugins (starlight-pydocs): it exists after `codeblocks()` runs `config:setup`, and `options.inlineHighlighting` and `options.apiLinks` are `false` or a truthy object. Nothing else is public; `test/starlight.test.ts` guards it.
- **Under `unified()`, one remark adapter runs the Sätteri plugin definition**, so each Markdown feature has one implementation. *Rejected:* a remark-native copy of each feature; a warning that the features are off.
- **`astro` is a peer dependency**, for `AstroError`. **tsdown** builds the package; **Biome** lints; TypeScript stays on 6 because `@astrojs/check` does not accept 7 yet.
- **Root `lint` and `test` build first**, because `astro check` and the tests read `dist/`. *Rejected:* a `prepare` script (pnpm 11 does not run it on every install).
- **`hast-util-from-html` is a runtime dependency**: the components parse the HTML that EC rendered. *Rejected:* `parse5` directly (a second conversion to hast); regular expressions.

## Client code

- **One loader in `jsModules`, feature modules emitted as hashed assets next to `ec.<hash>.js`.** `jsModules` load only on pages with code blocks. *Rejected:* `injectScript('page')` (loads on every page); all feature code inline (every page pays for every feature).
- **Sites without `codeblocks()` get a loader that carries every module's source** and imports from `blob:` URLs. It works with any EC integration, at the cost of a larger `ec.<hash>.js` there. *Rejected:* an extra Astro integration to install; `data:` URLs (a third larger).
- **Each client module builds on its own, with no shared chunks**, so a file works as a `blob:` module and the 3 kB budget is what a page downloads. The code walkthrough and runtimes are exempt.
- **Runtime modules are emitted at a fixed path** (`scb-runtime-<language>.js`, no hash), because code blocks render before the client build, so the URL must be known in advance.
- **Anchor positioning with a small script fallback.** *Rejected:* Floating UI (a dependency, over budget).
- **The API card on links outside code blocks** gets a page script and page CSS (`src/api-card-page.ts`), because `ec.<hash>.js` and EC's theme variables do not reach those pages. Its `data-scb-api-*` attributes are a public contract. The module guards against running twice, because in dev the two loaders reach it through two URLs.

## Syntax

- **The notation plugin parses in `preprocessLanguage`** and maps EC's own `{}`, `ins` and `del` markers to the lines that readers see. *Rejected:* two numbering schemes in one block.
- **A line that holds only directives is removed**, and its directives apply to the next visible line, as Shiki's transformers do (VitePress parity). A leading diff `+` or `-` does not count as code. JSX reads `{/* */}`.
- **Every directive works at the end of its line or on a line of its own above it.** A comment with other text keeps that text, and its directives apply to the comment line. *Rejected:* own-line-only directives for callouts, links and footnotes (a rule to learn, for no rendering gain).
- **Features declare their directives on their plugin**, so each feature stays in its own file. *Rejected:* a central directive list.
- **`notation.comments` maps a language to several syntaxes**; C-family, Vue, Svelte and Astro also accept `//` and `/* */`. Languages resolve through Shiki ids and aliases. The bracket scanner uses the same map.
- **The code switcher is a Sätteri container directive**, not an MDX component: it works in `.md` and `.mdx`, and each variant stays its own EC block with its own title, frame and copy text.
- **Inline highlighting:** the suffix inside the backticks is the documented form (`` `x{:js}` ``), as rehype-pretty-code; it needs no MDX escape and works with plugins that read `.md` as MDX. The form after the backtick still works. `{:txt}`, `{:plain}` and similar keep code plain. The inline engine reuses the site engine's captured themes with contrast correction off, and Astro's `shikiConfig` languages.
- **Each block setting of an option has a fence line attribute** that overrides it for the block, read with `blockSetting()`. The attribute is the option's own path, such as `lineStates.prefix=false`, so there is one name to learn and nothing to map. *Rejected:* short names such as `statePrefix` (a second name for each setting). The older short forms `footnotes="static"` and `expandable={N}` stay. A bad value warns and keeps the site value, as a bad directive does. Options that describe the site, such as custom states, playgrounds, runtimes and adapters, have none.
- **No `toPlainMarkdown` export.** No page action or raw Markdown plugin has a hook that could call it.

## Features

### Focus, line states, brackets, whitespace, word diff

- **Focus puts `tabindex="0"` on `pre > code`**, because EC removes it from a `pre` that does not scroll. A block that scrolls sideways has two tab stops; this is accepted. Lines lit by another feature (mention, permalink target, footnote, annotation) show clearly inside a focus.
- **Line states derive every tint from one colour**, so custom states match built-in ones. A state with no message shows its name once per run (WCAG 1.4.1, and forced colours). State names cannot be another attribute's name, or `label` or `prefix` (they collide with classes), or the aliases `note` and `warn`. `prefix: false` and `lineStates.prefix=false` hide every visible name, also on lines with no message, by the author's choice; screen readers still hear it, and the accessibility page lists it as an exception.
- **Messages on `[!code ++]`, `[!code --]` and `[!code highlight]` belong to line states**, which declares those directives again with `text: true`. With line states off, the text stays in the comment instead of disappearing. The label has no name: Expressive Code's marker already carries the meaning.
- **Colourised brackets use a language-agnostic string and comment scanner.** EC exposes no token scopes. Brackets are inline-style annotations, not class colours, so the contrast passes on tints correct them. The caret also outlines its pair, for keyboard users. *Rejected:* `@shikijs/colorized-brackets` (does not fit this stack); a tokeniser per language.
- **Colour swatches are on by default, and careful by context.** Stylesheets match every colour in a declaration value; other code needs quotes or a `:`, `=` or `,` before the colour; prose skips all-digit hex (issue numbers), short all-letter hex (`#cafe`) and bare colour names. A false positive in docs costs more than a missed swatch. A function gets a swatch only with literal numbers, because the browser draws the swatch from the text. Each colour becomes a button only once the client module loads, so a page without JavaScript has no dead tab stops. `<Example>` source panes set `swatches=false`, so they show what the author writes.
- **File icons use the icons and file name rules of Starlight's `<FileTree>`**, so a file looks the same in a tree and in a block. Starlight does not export them, so `scripts/file-icons.mjs` copies them into `file-icons-data.ts`, and a test fails when the installed Starlight differs. After the file name, the icon comes from the block language, then the default file icon, as in xt0rted/expressive-code-file-icons, whose `icon` and `no-icon` attributes it also reads. GitHub files (`.github/**`, `.gitattributes`) get the octocat from rules on the whole title path, which come before the set's rules; the user found Seti's YAML "!" ugly as the first icon on the homepage. Coloured sets (`material`, `vscode-icons`, `catppuccin`) take their icons from `@iconify-json/*` packages, optional peer dependencies, so a site installs only the set it uses (0.9 to 3.9 MB, against 6.7 MB for `material-icon-theme`). Their file name rules come from each VS Code icon theme manifest, which `scripts/icon-sets.mjs` copies into `icon-sets/*.ts` (loaded only for that set), keeping only icons that the Iconify package has. Ids are prefixed per icon. Light variants switch per theme through two style settings: `-light` icons for Material and vscode-icons, and Catppuccin Macchiato colours swapped for Latte. A name that a set lacks falls back to Seti. On by default, in editor frames with a title only. Colours from a site or a block are an inline CSS variable, so `light-dark()` covers both themes; a tile in a custom colour gets black or white from CSS relative colours, as the swatch chip does. The code switcher menu shares the lookup. *Rejected:* `vscode-icons-js` for rules (unchanged since 2023); every set as a full dependency (megabytes for every site); the file-icons set (Atom), whose VS Code theme draws glyphs from five icon fonts, and about a quarter of them, Python included, are not in any SVG package; importing Starlight's files by path (outside its exports); Seti colours per language (hex defaults, against the theme principle).
- **Visible whitespace draws its glyph on an `aria-hidden` element** over the real character, so copy and selection are unchanged. Glyphs are the code foreground at low alpha, with no contrast target, because they carry no meaning.
- **Word-level diff pairs `del` and `ins` runs through EC annotations**, so syntax colours survive with no second Shiki pass. Changes have a bar under them, removed words are also struck through, and both carry ARIA `insertion` and `deletion` roles, so the tint is not the only mark. Word tints are 25% in dark themes and 40% in light ones, with a 1 px bar in the diff colour under the change. Lower dark tints (15%) kept the syntax colours but made the change hard to see; a stronger dark tint makes the contrast pass wash the words out to plain text.

### Annotations, footnotes, callouts

- **Annotation notes are `popover="manual"`**, so several stay open and hover works while one is open. Hover shows a note after 80 ms and hides it 200 ms after the pointer leaves (WCAG 1.4.13); a click keeps it. The note opens out of its marker when it fits beside the code, otherwise centred below. *Rejected:* `popover="auto"` (closes the others); `popover="hint"` (no Firefox or Safari support yet); `position-try` alone (cannot see the code under the box).
- **Anchor names are set at build time**, so positioning works without JavaScript. A print-only list of notes follows the block.
- **Side annotations use width classes (`scb-side-600/800/1000`)** from the longest line at build time, and spread past the content column on pages without a table of contents. Starlight's content column is about 632 px, so a 640 px threshold would never show columns. The code column takes at least half the width, so short code does not leave the spare width empty beside short notes. Scrollycoding does the same. *Rejected:* a client script that measures (layout shift); `@container style()` (no Firefox support).
- **Footnote badges are links, and each note starts with its own number link back**, because notes can hold links and a link inside a link is invalid. Highlights toggle and several can stay on. `footnotes="static"` turns off the sticky list for one block.
- **Annotations and footnotes share two note styles, `filled` and `outline`**, set apart for each feature and each block. Annotations default to `filled`, footnotes to `outline`. The block's `data-scb-annotations` or `data-scb-footnotes` holds its style, and sets CSS variables that the rules read, so both styles can share a page. Each style has its own style settings, so a site can recolour one without the other. *Rejected:* one shared option for both features (a site may want them to differ).
- **One `startNoteNumber` attribute for annotations and footnotes**, named after EC's `startLineNumber`, since a block uses one note style. *Rejected:* `annotations.start` and `footnotes.start`, whose dotted names read as site options.
- **A callout is a sibling of its line**, so line tints and blur do not cover it. It takes the highlight of the lines around it when both sides match. Its width uses `cqi` of the `pre`, except in a side annotation grid, where containment would collapse the code column.

### Hidden lines, expandable blocks

- **Expandable blocks collapse only in the client**, with `hidden="until-found"`, so a block is complete without JavaScript and find in page reveals lines. Collapsed lines use `content-visibility: hidden` because EC's `all: revert` removes the browser's until-found style. `auto` skips switcher variants, runnable blocks and collapsible sections; the components remove an `auto` cap.
- **The hidden-lines toggle label changes, with no `aria-pressed`**, which would contradict the label. Open hidden lines dim to 0.75 opacity by the user's choice; syntax colours stay at 3:1 or more, and the accessibility page lists it as an exception with `openOpacity: '1'` to turn it off.
- **A manual selection leaves out closed hidden lines.** The copy button includes them. *Rejected:* a `copy` handler that adds them (the paste would differ from the selection).

### Copy, run, playgrounds, placeholders

- **Smart shell copy adds a Copy commands button, and the normal copy button copies the whole block.** The user found a copy button that copies less than the block confusing. Prompts are unselectable; output is selectable.
- **Python sessions follow the REPL's continuation rule**, not doctest's, so a printed `...` stays output. A `python` block is a session only when its first line is a prompt.
- **Placeholders replace text in build-time templates** (copy text, playground URLs, form fields). The TS Playground URL is compressed, so a second module with lz-string rebuilds it. Values persist in browser storage, with a fallback to memory.
- **The Run button uses `aria-disabled` while running**, so focus stays on it. There is no Stop button; the timeout stops runs. The output panel is an empty live region in the static HTML, so its first update is announced.
- **Pyodide runs in a `blob:` module worker** from a CDN URL (`pyodide({ url })` to change it), each run in fresh globals. Stopping ends the worker, because interrupts need cross-origin isolation that GitHub Pages does not send. *Rejected:* a `runnable.pyodideUrl` option.
- **Playground links read `data-code`**, so they get the text after every other feature has changed it.

### Links, mentions, permalinks

- **Code links open in the same tab**, as Starlight does. Only the first `/…/` in a directive is literal, so site-relative URLs work.
- **A code link with a description reuses the API links card and its attributes**, so it needs no new client code. The card is plain text, so the description loses its inline Markdown.
- **API adapters: `findSymbols(code, language, attributes)` returns each name with its link and card text**; there is no `resolve()`. Setup is lazy, on the first block in the adapter's languages. `fetch` caches in `node_modules/.cache/starlight-codeblocks/` (outside `.astro`, which the docs build deletes), never expires, and a failed fetch warns and leaves names plain.
- **The Python adapter fetches the page of each inventory name for a summary** through `describe()`, because `objects.inv` has none. A page is fetched once per build and kept on disk. A failed page is quiet (`fetch(…, { quiet: true })`): a summary is extra, and an offline build must not warn for each page. The summary is the first sentence of the Sphinx description, without asides in brackets, cut to 16 words; for a module, the title after the dash.
- **API card icons come from `simple-icons` (CC0), a runtime dependency**, so every project it covers gets an icon with no list to keep. The package is about 5 MB, so it loads only on the first block with an API link. The icon follows the project at the start of `source`; the paths go once on the figure, and each link holds only its slug. Icons are monochrome in the muted text colour, so they fit both themes. *Rejected:* a hand-picked vendored set (few libraries, and upkeep).
- **The Python adapter links only through imports** that the block does not rebind, plus the member after a call to a class. No built-ins. starlight-pydocs data comes from its registry at `globalThis[Symbol.for('starlight-pydocs')]`, read on every lookup so dev re-extraction works; `pydocsBase` on the fence picks a version.
- **The Nextflow adapter bundles its reference** and links operators only in a chain known to hold a channel, because `collect` and `first` are also Groovy list methods.
- **Code mentions pair in the browser** (works for `<Code>` and preset-only sites) with the next visible tagged block. The build check that strips unpaired links runs only when the render has a file (starlight-pydocs renders fragments without one).
- **Line permalinks draw their own gutter**; the plugin never adds `plugin-line-numbers`, which would turn numbers on for every block. A permalink to a hidden line opens it wherever it is (tab, `<details>`, switcher variant, walkthrough step, scrollycoding copy) without saving a switcher choice. `linksValidatorExclude()` exists because the validator collects ids before EC renders.

### Components

- **`<CodeWalkthrough>` and `<Scrollycoding>` read tokens from the HTML that EC rendered** and animate with magic-move's renderer, so colours match the static blocks and no Shiki reaches the browser. The move, the fade-in of new tokens and the tint of new lines all start at once (magic-move's delays at 0), so a step reads as one change. *Rejected:* magic-move's defaults, which move first and fade the new text in after.
- **Scrollycoding:** build-time copies under each step for the narrow and no-JavaScript layout, and a sticky column from 600 px. A code block between steps is a new version. Versions share one grid cell, so the height does not change and cannot loop the activation line. The active step is the one nearest the middle of the sticky block, from a throttled scroll listener. Hover does not clear the blur. Content other than blocks and steps fails the build.
- **Walkthrough controls sit under the block**, where the user found them easier to see than in the title bar.

## Accessibility

- **Faded text (focus, mentions, scrollycoding, collapsed fade) is a declared exception to WCAG 1.4.3** on the accessibility page, with the settings that turn the fade off, rather than a claim of conformance.
- **Syntax colours are corrected under tints that are always visible** (line states, word diff). Tints that only show when a line is active stay light enough (about 10%) to keep 4.5:1 without correction, because build-time correction changed the colours at rest too.
- **The figure gets an `aria-label` from the title bar text** without its controls, so names do not read "summary.py Hide 5 lines".
- **In print:** focus is a sharp 60% fade, scrollycoding prints its narrow layout, walkthroughs print every step, and fields print their value.

## Docs site

- **The docs site stays on Sätteri.** Plugins that need remark are supported through the adapter, not used here.
- **`<Example>` renders with `<Code>`**, output first, then the source; a live slot is used for prose, directives and components, and `scripts/examples.test.mjs` checks it matches. The first example on a page shows both panes at once; the ones under Examples use **Output** and **Source** tabs (`layout="tabs"`), so the section stays short. An example that shows nothing beyond the first one is dropped.
- **The homepage hero is a before/after slider of one block, rendered with `<Code>`**, so it shows real plugin output. It uses only features that keep line heights (focus, brackets, word diff, line states, annotations, API links), so the two layers line up; the plain layer turns off the features that start on their own. `Hero.astro` renders the slider through `Astro.self` and hands the HTML to Starlight's own hero as `image.html`, which keeps the default title, tagline and buttons. *Rejected:* a static image (shows no real output); copying Starlight's hero markup (drifts on upgrades).
- **Carousel slides equal each page's first example**, checked by a test. README samples are trimmed on purpose and have no check; audit them by hand when an example changes.
- **The site serves its own `.md` routes and `llms.txt`.** *Rejected:* starlight-page-actions (its copy strips `import` lines inside examples and leaves JSX) and starlight-llms-txt (builds from HTML and drops fence lines, which are the content here).
- **Share cards use astro-og-canvas**, with `canvaskit-wasm` as a direct docs dependency because pnpm otherwise breaks it.
- **Deploy is a job in `ci.yml` after the checks**, so a failing commit never publishes. *Rejected:* a separate workflow (published failed commits); `workflow_run` (zizmor flags it).
- **npm releases publish from `publish.yml` on a GitHub release**, through trusted publishing (OIDC), so no npm token is stored. The job checks that the tag matches the package version, and turns off the setup-node cache (zizmor: cache poisoning).
- **The agent skill lives at the repository root** and is copied into the package at pack time, because the `skills` CLI finds a root `skills/` first. *Rejected:* a symlink (npm pack does not follow it reliably).
