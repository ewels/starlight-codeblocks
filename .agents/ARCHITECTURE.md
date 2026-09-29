# Architecture

AGENTS.md gives the overall layout. This file has the conventions for adding a feature, and the facts about Astro, Starlight and Expressive Code that the design depends on. `<feature>` is the option key (`lineStates`), `<name>` is the kebab-case file name (`line-states`).

## How to add a feature

### Options

Add the key to `CodeblocksOptions` and `optionsReference` in `src/options.ts`, with a test in `test/options.test.ts`. A feature with settings takes `false` or an object, and a feature without settings takes only `false`. `true` is an error. The plugin receives `false`, `true` or an object with every default filled in. The docs read `optionsReference`, so its descriptions follow WRITING-STYLE.md.

### The Expressive Code plugin

- `pluginX(settings)` in `src/expressive-code/<name>.ts` returns a `CodeblocksPlugin` named `starlight-codeblocks:<name>`. Add it to `createPlugins()` behind `options.<feature>`, after core and notation, and export it. `focus.ts` is the smallest complete example; `line-states.ts` shows directive text, per-option style settings and extra nodes in a line.
- Keep per-block state in `AttachedPluginData`, never on `codeBlock.props`.
- Ranges: `resolveRange(context, key)`, in `preprocessCode` (the frames plugin removes the file name comment in its own `preprocessCode`, which runs first). Ranges count the lines that readers see, from 1, and ignore `startLineNumber`.
- Directives: declare them in the plugin's `directives` (`code <name>` for `[!code <name>]`, or a bare name), with `placement`, `text` and `docs`. Read them with `getDirectives(codeBlock, name)`. Render directive text with `inlineMarkdown()`.
- Warnings: `warn(context, message, line?)`. Bad input in a block warns and renders without the effect, so one typo never stops a site build. A malformed range fails.
- Apply effects to line objects, never to indexes. Find a rendered line with `lineElement(line)` and insert with `insertBefore()`.
- Extra nodes never change the copied text. Decorations get `user-select: none` and are added to the `scb-deco` list in `core.ts`. Text for screen readers goes in a `scb-sr-only` span.
- Title bar controls go through `addTitleBarControl()`. A control that needs JavaScript gets `scb-needs-js`.
- Anything inside `code` that lines up with the text adds `var(--scb-gutter, 0px)` to its start offset.
- Expressive Code's script removes `tabindex` from a `pre` that does not scroll. To make code focusable, put `tabindex="0"` on `pre > code`.

### Styles

- Settings live in a `codeblocks<Feature>` group, with a `declare module '@expressive-code/core'` block in the feature file. Type each as `UnresolvedStyleValue`. Reference them with `cssVar('codeblocksFocus.blur')`.
- Every colour default is a resolver from a theme colour, raised to its contrast target on that theme's code background: `themeColour()` and `onCode()` in `styles.ts`. Never a hex pair. Reuse the shared `codeblocks.*` settings where they fit.
- Contrast targets: text 4.5:1, bars and outlines that carry meaning 3:1. Tests measure against every theme in the shared test set, and `test/tints.test.ts` checks syntax colours on tints.
- Expressive Code shortens CSS variable names (`opacity` becomes `opa`, `Background` becomes `Bg`). Tests use `getCssVarName()`.
- The core plugin already gives `scb-` elements a focus ring, reduced-motion rules and print rules (`scb-no-print`), and styles `scb-sr-only` and `scb-float`.
- Never restyle what Expressive Code draws itself: frame, title bar, fonts, copy button, text markers.
- Describe each new setting in `styleSettingsReference` and each new attribute in `attributesReference` (`src/reference.ts`).

### Client module

Only when static HTML cannot do the job.

1. `src/client/<name>.ts`. Its default export runs on import and on every `astro:page-load`, so it skips elements that it has already set up (`data-scb-ready`). No top-level side effects.
2. Add `jsModules: clientJsModules` to the plugin, and set `data-scb-<name>` only on blocks that need the module. Use that attribute for nothing else.
3. Stay under 3 kB gzipped. Shared helpers go in `src/client/shared/` and are bundled into each module. No shared chunks, because they break the `blob:` loader.
4. Listen on the document and find targets with `closest()`, because full screen plugins show a `cloneNode(true)` copy with the same ids and no listeners. `swapInto()` handles copies that switch content.
5. Popovers stay inside the block's `.expressive-code` (it holds the theme variables) and use `scb-float` with `place()`, `follow()` or `below()` from `shared/position.ts`.
6. To reach a line that is hidden (expandable tail, hidden lines, closed `<details>`, Starlight tab, walkthrough step, code switcher variant), call `unhide()` from `shared/scroll.ts`. It sends `beforematch`, which each feature listens for.
7. To follow the reader's placeholder values, read `data-code` when you need it and listen for `scb-placeholders-change`.

### Tests and docs

- Unit tests use `render(markdown, options?, extraPlugins?)` from `test/render.ts`, which returns `{ html, copyText, warnings }`. Cover every attribute and directive, the copied text, the warnings, and that a block that does not use the feature renders the same with it off. Tests have no network: `test/setup.ts` stubs `fetch`.
- Playwright tests go against the feature's docs page, with the keyboard, the pointer and the `reduced-motion` project. Set the theme with `document.documentElement.dataset.theme`, and scroll with `behavior: 'instant'`.
- Write the docs page from the template in WRITING-STYLE.md, and update the skill.

## Platform facts

These came from reading the installed source. Check them again before you rely on them after a major upgrade.

- **Plugin registration.** `astro-expressive-code` serialises its options with `stableStringify`, which writes functions as `"[Function]"`, so `<Code>` throws on real plugin objects. That is why plugin properties are hidden and the ec-config module is overridden. `mergeEcConfigOptions` replaces arrays, so an `ec.config.mjs` `plugins` list drops Starlight's. Build and dev prerender in the same process, so the `globalThis` registry is visible to both.
- **Tabs.** `astro-expressive-code` expands tabs to `tabWidth` spaces before any plugin hook runs, so `codeblocks()` sets `tabWidth: 0` unless the site sets it. The core styles set `tab-size: 2` (`TAB_SIZE`).
- **Trailing whitespace.** The `ExpressiveCodeBlock` constructor trims line ends. The Markdown plugin passes it in a hidden `scbTrailing` fence attribute.
- **Copy text.** The frames plugin writes `button[data-code]` in `postprocessRenderedBlock`, with newlines as `\x7F`, and reads it at click time. Our plugins run after it and can overwrite it. It strips `#` comment lines from terminal frames first.
- **Code edits.** Expressive Code allows code edits only from `preprocessCode`. The text markers plugin attaches `{2}` and `ins={3}` to source lines in `preprocessMetadata`, so notation moves them to the lines that readers see.
- **Client code.** `jsModules` go into one `ec.<hash>.js`, only on pages with code blocks. It is an emitted asset, so bare `import()` specifiers inside it are not resolved. In dev, Vite rewrites a literal `new URL('./x.js', import.meta.url)`, so read `import.meta.url` into a variable first. `injectScript('page')` loads on every page.
- **Themes.** The base theme's variables are on `:root`; the other theme's apply only inside `.expressive-code`. Anything outside a block (inline code, the page API card) needs its own stylesheet, built from the engine's `styleVariants` through a virtual module in Starlight's `customCss`.
- **Sätteri.** Plugins push to `markdown.processor.options.mdastPlugins`. A container directive plugin must return a replacement node, or `starlight-directives-restoration` turns it back into text. `{ raw }` is parsed as Markdown and wrapped in `<p>`. `ctx.report` does not reach Astro's output, so warnings go through the integration logger. A plugin object is reused across documents; use a factory entry for per-document state. `textContent()` skips raw HTML, so inline code returns hast (`data.hName`, `hChildren`), not an `html` node.
- **MDX.** `{:js}` after a backtick is a JavaScript expression. `{:lang}` inside the backticks needs no escape.
- **Components.** `Astro.slots.render('default')` returns the HTML that Expressive Code rendered. Token spans carry `--0`/`--1` colour variables, nested where themes agree. `@shikijs/magic-move/core` keys tokens at build time; the renderer runs with no Shiki in the browser. magic-move sets a unitless `--smm-stagger: 0`, which breaks its own `calc()` delays, so the plugin sets `0ms`.
- **Content cache.** Astro 7 caches rendered Markdown in `node_modules/.astro`. `docs:build` deletes it; `astro build --force` also works but warns.
- **Link validation.** starlight-links-validator collects ids before Expressive Code renders, hence `linksValidatorExclude()`.
