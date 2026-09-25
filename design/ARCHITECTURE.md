# Architecture

Results of the phase 1 spike. Every answer below comes from a real build of a throwaway site with the versions in the table, and from reading the installed source in `node_modules`. The experiments are not committed.

| Package | Version tested |
|---|---|
| `astro` | 7.3.5 (Vite 8.3.1) |
| `@astrojs/starlight` | 0.42.4 |
| `astro-expressive-code`, `expressive-code`, `@expressive-code/*` | 0.44.2 |
| `@astrojs/markdown-satteri` / `satteri` | 0.4.2 / 0.10.5 |
| `@astrojs/mdx` | 8.0.2 |
| `@shikijs/magic-move`, `shiki` | 4.4.3 |
| `starlight-pydocs` | 0.2.1 |

Source files referenced below are relative to each package's install directory.

## Summary

| Question | Answer | Consequence |
|---|---|---|
| Q1 Registration | `updateConfig({ expressiveCode })` works for fenced blocks, but breaks `<Code>`, and is silently overwritten by an `ec.config.mjs` that has `plugins`. | Hybrid route: auto-registration with serialisation-safe plugin objects plus a Vite override for `<Code>`; when `ec.config.mjs` lists plugins, the author adds `pluginCodeblocks()` to it (build error otherwise). |
| Q2 Sätteri plugins | Yes. An Astro integration from `addIntegration` can push to `config.markdown.processor.options.mdastPlugins`. `:::code-switcher{sync="pm"}` parses with code children, in `.md` and `.mdx`, and Expressive Code renders the children. | Build the code switcher as a directive. No MDX fallback needed. |
| Q3 Copy text | Both work. Edits in `preprocessCode` reach `data-code`. Our `postprocessRenderedBlock` runs after the frames plugin and can overwrite `data-code`. | No click interception. Runtime changes (placeholders) update `button.dataset.code`. |
| Q4 Client modules | `jsModules` land in one `ec.<hash>.js` on pages with code blocks only. A loader there can `import()` modules that our Vite plugin emits next to it. `injectScript('page')` lands on every page. | One loader in `jsModules`; feature modules prebuilt and emitted as assets. Components use their own `<script>`. |
| Q5 Inline highlighting | Yes. An async mdast `inlineCode` visitor sees the `{:lang}` suffix, highlights with an Expressive Code engine that uses the site's themes, and returns an `html` node. | Phase 10 is not blocked. MDX needs `\{:lang}`. |
| Q6 MDX components | `Astro.slots.render('default')` returns the HTML that Expressive Code rendered. Token spans carry `--0`/`--1` colour variables. `@shikijs/magic-move/core` keys tokens at build time; `@shikijs/magic-move/renderer` animates them with no Shiki in the browser (1.8 kB gzipped). | Read tokens from the rendered HTML. Do not highlight twice. |
| Q7 Line numbers | Do not add `@expressive-code/plugin-line-numbers`. Our own gutter element renders link numbers for `id` blocks and removes the other plugin's numbers when both are present. | No duplication, no change to other blocks. |
| Q8 Theme colours | Style settings take `({ theme }) => …` resolvers or `[dark, light]` pairs. Base theme variables are on `:root`; the other theme's variables apply only inside `.expressive-code`. | Popovers and hover cards must be DOM descendants of the block. Inline highlighting ships its own CSS. |
| Q9 starlight-pydocs | No Node API, no data file with a stable path, no content collection. It exposes `<base>/symbols.json` and `<base>/objects.inv` endpoints, a Vite virtual module, and TypeScript-source subpath exports that only run inside Vite. | Fallback: read the Griffe dump and map objects to pydocs URLs. Gap recorded; an upstream Node API is the real fix. |

## Q1. Registering Expressive Code plugins

### Answer

A Starlight plugin can add Expressive Code plugins with `updateConfig({ expressiveCode: { ...ec, plugins: [...] } })` in `config:setup`. Starlight passes the object by reference to `astroExpressiveCode()` (`@astrojs/starlight/dist/integrations/expressive-code/index.js`), and its schema accepts any object (`dist/schemas/expressiveCode.js`). Fenced blocks then use the plugins. Two cases fail:

1. **`<Code>` component.** `astro-expressive-code` serialises the integration options into `virtual:astro-expressive-code/config` with `stableStringify`, which writes functions as `"[Function]"`. The component's renderer (`astro-expressive-code/components/renderer.ts`) throws when it finds that string.
2. **`ec.config.mjs` with `plugins`.** `mergeEcConfigOptions(integrationOptions, ecConfigFileOptions)` (`astro-expressive-code/dist/index.js`) deep-merges only `defaultProps`, `frames`, `shiki` and `styleOverrides`. Arrays are replaced. The file's `plugins` array replaces the one from the Starlight plugin, with no warning.

A working route for both, when `ec.config.mjs` has no `plugins` key:

- Hide every property except `name` on the plugin objects that go into `expressiveCode.plugins` (non-enumerable). `stableStringify` uses `Object.keys`, so the serialised config has no functions. Expressive Code core reads `plugin.hooks` directly (`@expressive-code/core/dist/index.js`, `this.plugins = [...corePlugins, ...config.plugins?.flat()]`), so the Markdown path works.
- Add a Vite plugin (`enforce: 'pre'`) that resolves `virtual:astro-expressive-code/ec-config` to our own module. The module imports the author's `ec.config.mjs` if there is one, and appends the real plugin objects from a `globalThis` registry that `codeblocks()` fills in `config:setup`. The `<Code>` renderer merges this over the integration options, so the real plugins replace the hidden ones.

`astro build` prerenders in the same Node process (the stack trace points to `dist/.prerender/chunks/*.mjs`), and `astro dev` uses an in-process module runner, so the registry is visible in both.

### Evidence

Site: Starlight with a test Starlight plugin, a test Expressive Code plugin that adds `data-spike-<tag>` to each block, a fenced block and a `<Code>` block.

| Set-up | Fenced block | `<Code>` |
|---|---|---|
| `updateConfig` only, no `ec.config.mjs` | plugin runs | build fails: "Your Astro config file contains Expressive Code options that are not serializable to JSON…" |
| `updateConfig` + `ec.config.mjs` with `plugins: [other]` | only `other` runs (ours lost) | — |
| Hidden properties + ec-config override, no `ec.config.mjs` | plugin runs | plugin runs (build and `astro dev`) |
| Hidden properties + override, `ec.config.mjs` with `styleOverrides` only | plugin runs | plugin runs |
| Hidden properties + override, `ec.config.mjs` with `plugins: [other]` | only `other` runs | both run |
| Preset listed in `ec.config.mjs` | plugin runs | plugin runs |

### Design choice

`codeblocks()` does this in `config:setup`:

1. Fail if `config.expressiveCode === false`.
2. Store the resolved options and the real plugin objects in the registry (`globalThis[Symbol.for('starlight-codeblocks')]`).
3. Import `ec.config.mjs` from `astroConfig.root`, if it exists (same way as `loadEcConfigFile`: `import(new URL('./ec.config.mjs?t=' + Date.now(), root).href)`).
4. If its `plugins` contains our plugins (names start with `starlight-codeblocks:`), do nothing more for Expressive Code.
5. If it has a `plugins` key without ours, fail the build with a message that gives the one-line fix: add `pluginCodeblocks()` to `plugins`.
6. Otherwise, add the hidden plugin objects with `updateConfig`, and add the ec-config override through `addIntegration`.

`pluginCodeblocks(options?)` uses the options it gets. With no argument it uses the options in the registry, so a Starlight site keeps all options in `codeblocks()`. Recorded in `DECISIONS.md`.

## Q2. Sätteri plugins

### Answer

- **Shape.** A Sätteri plugin is an object with a `name` and one visitor per node type (`dist/mdast/mdast-visitor.d.ts`, `dist/hast/hast-visitor.d.ts`). mdast visitors are keyed by type (`inlineCode`, `containerDirective`, `code`, …). hast visitors use `element: { filter: ['pre'], visit }`. Visitors can be async. A visitor returns a replacement node, or uses `ctx.replaceNode`, `ctx.removeNode`, `ctx.setProperty`, `ctx.parent`, `ctx.indexOf`. Entries in `mdastPlugins` can also be factories `({ fileURL, sourceFormat, source, data }) => plugin | plugin[] | null`, called once per document. `satteri-emoji` and Starlight's own `dist/integrations/satteri.js` are good examples.
- **Registration.** Starlight registers its own plugins by pushing to `config.markdown.processor.options.mdastPlugins` and `hastPlugins` in `astro:config:setup` (`dist/integrations/markdown-plugins.js`). An integration added with `addIntegration` runs before `astro-expressive-code` and before `starlight-directives-restoration`, which Starlight adds last on purpose so that plugin integrations can claim directives first. Observed order: `@astrojs/starlight, spike-integration, astro-expressive-code, @astrojs/sitemap, @astrojs/mdx, starlight-directives-restoration`. `isSatteriProcessor()` from `@astrojs/markdown-satteri` returns true on a default Astro 7 site.
- **Directive.** Starlight sets `features.directive = true`. `:::code-switcher{sync="pm"}` arrives as `containerDirective` with `name: 'code-switcher'`, `attributes: { sync: 'pm' }` and two `code` children with their `lang` and `meta`, in both `.md` and `.mdx`.
- **Rendering.** Returning `{ type: 'paragraph', data: { hName: 'div', hProperties: {...} }, children }` (the pattern Starlight uses for asides) gives a wrapper `div` with both code blocks inside, each rendered by Expressive Code with its own copy text. New `code` nodes with an extended `meta` (`switcherIndex=0`) reach Expressive Code as meta options.

### Evidence

Build log from a `.md` page and the same content in `.mdx`:

```
[SAT] switcher markdown {"sync":"pm"} [{"type":"code","lang":"sh","meta":"label=\"npm\""},{"type":"code","lang":"sh","meta":"label=\"pnpm\" title=\"pnpm.sh\""}]
[SAT] switcher mdx {"sync":"pm"} [...same...]
```

Output: `<div class="spike-switcher" data-sync="pm">` with two `.expressive-code` blocks, `data-code="npm install x"` and `data-code="pnpm add x"`, and `data-switcher-index="0"` / `"1"` set by the Expressive Code plugin from the injected meta.

### Design choice

Build the code switcher as a Sätteri container directive (step 7.3). The mdast plugin checks that every child is a `code` node (build error otherwise), then rewrites each child's meta to carry the switcher group, its index and the list of labels, and wraps them in a `div`. The Expressive Code plugin reads that meta and renders the menu into the title bar of each variant, so the markup is complete without JavaScript. The MDX component fallback is not needed.

## Q3. Copied text

### Answer

The frames plugin builds the copy text in its `postprocessRenderedBlock` hook from `codeBlock.code` (`@expressive-code/plugin-frames/dist/index.js`), after it removes `#` comment lines in terminal frames (`removeCommentsWhenCopyingTerminalFrames`). It encodes newlines as U+007F and puts the text in `button[data-code]`. Its click handler reads `button.dataset.code` at click time.

- Line edits (`line.editText`) and deletions (`codeBlock.deleteLine`) in `preprocessCode` reach `data-code` with no other change.
- Frames and the other default plugins come before user plugins, so our `postprocessRenderedBlock` runs after the frames one. It can find `button[data-code]` in `renderData.blockAst` and overwrite `properties.dataCode`.

### Evidence

| Block | `data-code` (U+007F shown as `<DEL>`) |
|---|---|
| `const a = 1 // [!spike]`, own-line `// [!own] removed line`, `console.log(a)` | `const a = 1<DEL>console.log(a)` |
| `copy="OVERRIDE"` (plugin overwrites in `postprocessRenderedBlock`) | `OVERRIDE` |
| `sh` block with `# comment` and `npm install x` | `npm install x` |

### Design choice

- Directive removal and own-line directives: `preprocessCode`. Nothing else needed.
- Smart shell copy and any other copy text that differs from the rendered code: overwrite `data-code` in `postprocessRenderedBlock`, with newlines as `\x7F`. For terminal frames, compute the text from `codeBlock.code` ourselves, because frames has already stripped comment lines.
- Placeholders: the build writes the placeholder text; the client module sets `button.dataset.code` when a field changes. No click interception.

## Q4. Client modules

### Answer

- `astro-expressive-code` collects every plugin's `jsModules` (strings, or a function of the resolver context), removes duplicates, joins them, and emits one `/_astro/ec.<hash>.js` asset (`createAstroRenderer`). It adds a `<script type="module" src>` for it only to the first code block group of a page. Pages with no code block get neither `ec.*.js` nor `ec.*.css`. `<Code>`-only pages get the same file.
- The file is an emitted asset, not a Vite module, so `import('pkg/x')` inside it is not resolved or bundled. A relative dynamic import works if the target file sits next to it: our Vite plugin emits the feature files into the same assets folder (`emitFile({ type: 'asset' })` in `buildEnd`, `apply: 'build'`) and serves them from memory in dev (`resolveId`/`load` for `/_astro/<file>`), the same way `astro-expressive-code` serves `ec.*.js`.
- In dev, Vite serves `ec.*.js` through its transform pipeline and rewrites `new URL('./x.js', import.meta.url)` to `/%00/_astro/x.js`. Reading `import.meta.url` into a variable first avoids the rewrite.
- `injectScript('page', …)` puts the code into the shared `page.<hash>.js`, which loads on every page, including pages with no code. Starlight's plugin API has no script hook of its own.
- An Astro component `<script>` is bundled by Vite and loads only on pages that use the component.

### Evidence

- `dist/nocode/index.html` has no `ec.*` script or stylesheet; `dist/index.html` has `/_astro/ec.1dof4.js`.
- Loader in `jsModules`: `const here = import.meta.url; import(new URL('./spike-feature.js', here).href)`. In the browser: the feature module was requested and marked all four blocks, in `astro preview`, in `astro dev`, and with `base: '/docs'` (`/docs/_astro/spike-feature.js`).
- With the literal `new URL('./spike-feature.js', import.meta.url)`, dev requested `http://localhost:4403/%00/_astro/spike-feature.js`.
- `injectScript('page', "console.log('SPIKE_INJECTED_MARKER')")`: the marker is in `page.Cfu1UXrk.js`, which `dist/nocode/index.html` loads.
- `CodeSteps.astro` with a `<script>`: its bundle appears only in `dist/steps/index.html`.

### Design choice

One route for all block features:

1. Each feature's Expressive Code plugin marks the blocks that need client code with a data attribute (`data-<prefix>-<feature>`).
2. One loader, the same string in every feature plugin's `jsModules` (Expressive Code removes duplicates), finds the attributes on the page and imports the matching modules. It also runs on `astro:page-load`.
3. Feature modules are TypeScript in `src/client/`, prebuilt by the package build into `dist/client/` (minified ESM, hashed file names, shared helpers as chunks with relative imports).
4. `codeblocks()` adds a Vite plugin (through `addIntegration`) that emits `dist/client/*` into `build.assets` in build and serves it in dev. The loader's map from feature to file name is generated from the build output, so it changes when the files change.
5. `<CodeSteps>` and `<Scrollycoding>` use an Astro `<script>`, which Vite bundles and loads only on their pages.
6. Runtimes load with `import()` from the Run button module, only on Run.

A page with code blocks but no interactive feature gets the loader bytes inside `ec.*.js`, which the page already loads for the copy button, and no extra request. A page with no code blocks gets nothing.

Settled in step 3.3: sites that use the preset without `codeblocks()` get a loader that carries the module sources and imports them from `blob:` URLs (DECISIONS.md, "Client modules on sites without codeblocks()").

## Q5. Inline code highlighting

### Answer

Tried: a Sätteri mdast `inlineCode` visitor. It works.

- **Seeing the suffix.** With directives on (Starlight), `` `await fetch(url)`{:js} `` arrives as `inlineCode`, then `text "{"`, then `textDirective` named `js`, then text that starts with `}`. The visitor reads the siblings with `ctx.parent(node).children[ctx.indexOf(node) + 1 …]`. With directives off, the suffix is a plain text node `{:js}…`.
- **Highlighting.** The visitor is `async`. It calls `new ExpressiveCode({ themes, frames: false, textMarkers: false, useStyleReset: false }).render({ code, language })` from the `expressive-code` package and takes the token spans from the `.ec-line .code` element. `themes` are the site's themes, taken from the real engine: our Expressive Code plugin stores `styleVariants.map((v) => v.theme)` in the registry when its `baseStyles` resolver runs, which happens when `astro-expressive-code` creates its renderer in `astro:config:setup`, before any content renders. Log: `inline engine themes ["Night Owl No Italics/dark","Night Owl Light/light"]`.
- **Replacing.** Return `{ type: 'html', value: '<code …>…</code>' }` and remove the three suffix nodes (`ctx.removeNode`, `ctx.setProperty(close, 'value', close.value.slice(1))`). Returning `{ raw: html }` wraps the code in a `<p>` in `.md` files, so do not use it.
- **MDX.** `{:js}` is a JavaScript expression in MDX and fails the build ("Could not parse expression with oxc"). Authors must write `` `code`\{:js} ``, which arrives as the same three nodes.
- **Unknown languages.** Check `lang in bundledLanguages` (from `shiki`, plus any `shiki.langs` in the config) before rendering; Expressive Code otherwise logs its own error. `ctx.report({ severity: 'warning' })` does not appear in Astro's build output, so warnings go through the integration's logger.

Output in `.md` and `.mdx`:

```html
<code class="spike-inline" data-lang="js"><span style="--0:#C792EA;--1:#8844AE">await</span><span style="--0:#D6DEEB;--1:#403F53"> </span><span style="--0:#82AAFF;--1:#3B61B0">fetch</span>…</code>
```

### Design choice

Phase 10 is not blocked. Build inline highlighting as a Sätteri mdast plugin, registered by the same integration as the code switcher. Token colours stay as `--0`/`--1` variables. The plugin ships its own small stylesheet (Starlight `customCss`), because `ec.*.css` is missing on pages without code blocks and the light-theme variables apply only inside `.expressive-code` (see Q8). Background colours come from `theme.bg` of each captured theme. The docs page must tell MDX authors about `\{:lang}`.

## Q6. MDX components

### Answer

- An Astro component that wraps fenced blocks in MDX gets their HTML, already rendered by Expressive Code, from `await Astro.slots.render('default')`, the same as Starlight's `<Tabs>`.
- Token data: parse the HTML with `hast-util-from-html`, select each `.expressive-code` block, walk the text nodes under `.ec-line .code`, and join the `style` of every ancestor span. Expressive Code nests spans when themes agree on part of a token, for example `<span style="--1:#403F53"><span style="--0:#D6DEEB">(</span>…`. Each token then carries `--0:<dark>;--1:<light>`.
- `@shikijs/magic-move/core` has `toKeyedTokens(code, tokens)` and `syncTokenKeys(from, to)`. It imports only `diff-match-patch-es` and `ohash`, so it runs at build time in the component. `@shikijs/magic-move/renderer` has `MagicMoveRenderer`, whose `render(step)` takes the precompiled `KeyedTokensInfo` and applies `token.htmlStyle`, so the `--0`/`--1` variables survive and the theme switch works with CSS. This is the precompiled mode; no Shiki in the browser.
- Each block's copy text is in its `button[data-code]`.

### Evidence

Two steps (`const app = express()`, then the same plus `app.use(express.json())`):

```
data-count="2" data-shared="[8]" data-copy="["const app = express()","const app = express()app.use(express.json())"]"
data-first="[{"content":"const","offset":0,"htmlStyle":"--0:#C792EA;--1:#8844AE","key":"…-0"}, …]"
```

Eight tokens of step 2 keep their keys from step 1. The component `<script>` that imports `MagicMoveRenderer` built to 6,080 bytes, 1,848 bytes gzipped, loaded only on the steps page.

### Design choice

`<CodeSteps>` and `<Scrollycoding>` read tokens from the rendered HTML, key them at build time, and serialise the steps into the page. The client imports only `@shikijs/magic-move/renderer` (and its `style.css`). No second highlighter run, so the colours match the static blocks exactly.

## Q7. Line numbers

### Answer

- `@expressive-code/plugin-line-numbers` turns numbers on for every block unless `defaultProps.showLineNumbers` is `false`, so adding it from the plugin changes every block on the site.
- An Expressive Code plugin can add its own gutter with `addGutterElement` in `preprocessMetadata`. For `id` blocks, a gutter that renders `<a class="ln" href="#cfg-L1">1</a>` works with or without the line numbers plugin, and reuses that plugin's `.gutter .ln` styles when it is present.
- If the line numbers plugin is also on for the block, the gutter has two numbers. Our `postprocessRenderedLine` can remove the other plugin's `div.ln` from `renderData.lineAst`.

### Evidence

- No line numbers plugin: `<div class="gutter"><a class="ln" href="#cfg-L1">1</a></div>`.
- With the line numbers plugin on: `<div class="ln" aria-hidden="true">1</div><a class="ln" href="#cfg-L1">1</a>` before the fix, and only the link after it.

### Design choice

The plugin never adds `@expressive-code/plugin-line-numbers`. The permalinks plugin renders its own link gutter for `id` blocks, with base styles for the case where the line numbers plugin is missing, and removes that plugin's numbers from `id` blocks. It must honour `startLineNumber` and the "line numbers the reader sees" rule in `SPEC.md`.

## Q8. Theme colours

### Answer

- A plugin declares `styleSettings: new PluginStyleSettings({ defaultValues: { <prefix>: { … } } })`. A value is a string, a `[dark, light]` pair (picked by `theme.type`), or a resolver `({ theme, resolveSetting }) => string`. `theme.colors` holds the VS Code theme colours, `theme.bg`/`theme.fg` the main colours. Authors override values with `styleOverrides` (`@expressive-code/core/dist/index.js`, `resolveStyleSettings`).
- Plugins read the active themes from `styleVariants` (each has `theme`, `resolvedStyleSettings`, `cssVarDeclarations`) in the `baseStyles` and `jsModules` resolver context, and from `styleVariants` and `config` (with `themes` and `themeCssSelector`) in every hook.
- Starlight sets `themeCssSelector` to `[data-theme='dark']` / `[data-theme='light']` and turns on the `prefers-color-scheme` media query (`dist/integrations/expressive-code/preprocessor.js`).
- Generated CSS: base theme variables on `:root`; the alternate theme's variables on `:root[data-theme='light'] .expressive-code:not([data-theme='dark']), .expressive-code[data-theme='light']`, and in `@media (prefers-color-scheme: light) { :root:not([data-theme='dark']) { … } }`.

### Evidence

From `dist/_astro/ec.*.css` of the spike:

```
:root, :root:not([data-theme='dark']) .expressive-code[data-theme='dark'] { --ec-spike-cardBg:#011627; --ec-spike-tint:#ff000033 }
:root[data-theme='light'] .expressive-code:not([data-theme='dark']), .expressive-code[data-theme='light'] { --ec-spike-cardBg:#f0f0f0; --ec-spike-tint:#00ff0033 }
```

`#011627` is `editorHoverWidget.background`-or-`bg` of Night Owl; `#f0f0f0` is the same for Night Owl Light.

### Design choice

- All colours are style settings, so `styleOverrides` works. Dark and light values are `[dark, light]` pairs or resolvers from theme colours.
- Popovers, hover cards and footnote panels must be DOM descendants of the block's `.expressive-code` element. Custom properties inherit through the DOM, also into the top layer of a `popover`, so they get the right theme. A card outside the block would get the dark values on a light page.
- Code outside blocks (inline highlighting) does not use `--ec-*` variables. It has its own stylesheet with `:root[data-theme='light']` rules and the `prefers-color-scheme` fallback.
- Client code that must know the theme reads `document.documentElement.dataset.theme`.

## Q9. starlight-pydocs data

### Answer

starlight-pydocs 0.2.1 (npm and GitHub `main`, 25 September 2026) exposes no build-time API for other plugins:

- It extracts each package with Griffe in `config:setup` and caches the dump at `<cacheDir>/starlight-pydocs/<name>-<hash12>/dump.json` (`lib/cache.ts`, default `cacheDir` is `node_modules/.astro`). The path is internal.
- It passes the dump paths to its routes through the Vite virtual module `virtual:starlight-pydocs/context` (`libs/vite.ts`, `lib/context.ts`).
- It serves `<base>/symbols.json` (path, kind, page, anchor, one-line summary) and `<base>/objects.inv` as endpoints of the built site (`routes/symbols.ts`, `routes/inventory.ts`).
- Its subpath exports (`starlight-pydocs/render`, `/pages`) are TypeScript source that needs the virtual context. Node refuses to import them outside Vite: `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`.
- No content collection.

URL scheme (`lib/paths.ts`, `moduleSlug`): one page per module at `/<base>/<module path after the package, with / separators>/`, and the anchor is the dotted object path (none for modules).

### Evidence

A build with `starlightPydocs({ packages: [{ name: 'demopkg', search: ['./py'] }] })` wrote `dist/api/demopkg/{index.html,symbols.json,objects.inv,llms.txt}` and `node_modules/.astro/starlight-pydocs/demopkg-1bc6de33edf5/dump.json`. `symbols.json`:

```json
{"package":"demopkg","base":"api/demopkg","symbols":[{"path":"demopkg.greet","kind":"function","page":"api/demopkg","anchor":"demopkg.greet","brief":"Say hello to someone."}, …]}
```

The Griffe dump has, per object, `kind`, `path`, `docstring.value` and `parameters` with annotations, so it can also give signatures.

### Design choice

The fallback applies. The Python adapter takes a `pydocs` option (`{ package, base, dump? }`). It reads the Griffe dump from `dump`, or else finds the newest `starlight-pydocs/<package>-*/dump.json` in the cache folder. It builds an in-memory inventory with href, kind, signature and first docstring sentence, using the pydocs URL scheme above. Content renders after every `config:setup`, so the dump exists when the adapter's `setup()` runs. The gap and the proposed upstream fix (a small Node API in starlight-pydocs that returns its symbols with hrefs) are in `DECISIONS.md`.

## Other findings for later steps

- **Content cache.** Astro 7 caches rendered Markdown in the content layer data store. After a plugin change, a build can serve stale HTML. Use `astro build --force`, or delete `.astro/` and `node_modules/.astro/`, in tests and in the Playwright set-up.
- **pnpm 11** blocks build scripts. Add `allowBuilds: { esbuild: true }` to `pnpm-workspace.yaml`.
- **Astro 7 dev and preview servers** use a lock file. A second `astro preview` prints "Preview server running at …" and exits. Use `astro preview stop`, or `--ignore-lock` in the Playwright `webServer` command.
- **Build warnings in a bare Starlight site** (the docs build must have none): the missing `i18n` collection, the missing `404` entry, `@astrojs/sitemap` without `site`, and a Vite `MODULE_LEVEL_DIRECTIVE` warning ("use astro:head-inject") for every `.mdx` page. Step 2.1 must fix or filter each one.
- **Dependencies.** `@expressive-code/core` is not hoisted under pnpm, so the package must list it (and `expressive-code` for Q5, `hast-util-from-html` and `hast-util-select` for Q6, `@shikijs/magic-move`) itself.

## How to add a feature

Phase 3 built the shared parts. Every feature from phase 4 on follows the conventions below. `<feature>` is the option key in camel case (`lineStates`), `<name>` is the same in kebab case (`line-states`).

### Where files go

```
src/options.ts                        CodeblocksOptions, ResolvedOptions, optionsReference (option docs)
src/index.ts                          codeblocks(): validates options, registers plugins (Q1)
src/integration.ts                    Astro integration: ec-config override, client module Vite plugins
src/registry.ts                       globalThis registry (options, real plugins, clientAssets flag)
src/client-modules.ts                 reads dist/client, builds the loader, clientJsModules
src/expressive-code/index.ts          pluginCodeblocks(), createPlugins(): the preset, in order
src/expressive-code/core.ts           pluginCore(), CodeblocksPlugin, resolveRange(), warn(), fail(), numberedLines()
src/expressive-code/notation.ts       pluginNotation(), getDirectives(), DirectiveSpec, the parser
src/expressive-code/ranges.ts         parseRange()
src/expressive-code/comments.ts       comment syntax map
src/expressive-code/inline-markdown.ts inlineMarkdown() for directive text
src/expressive-code/styles.ts         shared style settings, base styles, PREFIX
src/expressive-code/<name>.ts         the feature's Expressive Code plugin (new)
src/client/<name>.ts                  the feature's client module, if it needs one (new)
src/client/shared/                    browser helpers bundled into each module: position.ts (place())
src/satteri/, src/components/         code switcher, inline highlighting, CodeSteps, Scrollycoding (later)
test/<name>.test.ts                   unit tests through render()
docs/e2e/<name>.test.ts               Playwright tests against the docs page
docs/src/content/docs/features/<name>.mdx   the feature page (DOCS-SITE.md template)
```

### 1. Options

The keys and their types are already in `CodeblocksOptions` and `optionsReference` (`src/options.ts`). If the feature's settings differ from SPEC section 3, change both, with a test in `test/options.test.ts`. The docs options reference reads `optionsReference`, so write its descriptions in the docs style. The feature receives its resolved settings: `false`, `true` (features with no settings) or an object with every default filled in.

### 2. The Expressive Code plugin

Write `pluginX(settings)` in `src/expressive-code/<name>.ts`. It returns a `CodeblocksPlugin` named `starlight-codeblocks:<name>`. `codeblocks()` finds its plugins by that prefix. Add it to `createPlugins()` in `src/expressive-code/index.ts` behind `options.<feature>`, after `pluginCore()` and `pluginNotation()`, and export it from that file. Store state for a block with `AttachedPluginData`, never on `codeBlock.props`. `src/expressive-code/focus.ts` is the smallest complete example; `line-states.ts` shows directive text, per-option style settings and extra nodes in a line.

```ts
const focusData = new AttachedPluginData<{ lines: Set<ExpressiveCodeLine> }>(() => ({ lines: new Set() }));

export function pluginFocus({ style = 'blur' } = {}): CodeblocksPlugin {
  return {
    name: 'starlight-codeblocks:focus',
    directives: { 'code focus': { placement: 'end', docs: { description, example, page: 'features/focus' } } },
    styleSettings,                 // the codeblocksFocus group, see step 4
    baseStyles: ({ cssVar }) => css, // scoped to .expressive-code by Expressive Code; can depend on settings
    hooks: {
      preprocessMetadata(context) {
        const { lines } = focusData.getOrCreateFor(context.codeBlock);
        for (const line of resolveRange(context, 'focus') ?? []) lines.add(line);            // focus={4-7}
        for (const d of getDirectives(context.codeBlock, 'code focus')) for (const l of d.lines) lines.add(l);
      },
      postprocessRenderedLine({ codeBlock, line, renderData }) {
        if (/* line is out of focus */) addClassName(renderData.lineAst, 'scb-focus-out');
      },
      postprocessRenderedBlock({ codeBlock, renderData }) {
        const code = select('pre > code', renderData.blockAst);   // hast helpers: '@expressive-code/core/hast'
      },
    },
  };
}
```

- A rendered line is `div.ec-line > div.code > spans`. Add classes to `renderData.lineAst`, and extra nodes (labels, buttons) inside `select('.code', lineAst)`. Extra nodes never change the copied text, which comes from the code, not the HTML. Give decorations `user-select: none` so that a manual selection leaves them out too, and put text for screen readers in a `scb-sr-only` span.
- Expressive Code's own script removes `tabindex` from a `pre` that does not scroll. To make the code area focusable, put `tabindex="0"` on `pre > code` and give it a focus style (as `focus.ts` does).
- Once a feature is in the preset, its directives are known. A test elsewhere that uses them as an unknown directive must change.

### 3. Attributes and directives

- Attributes: read them with `codeBlock.metaOptions`. For a range, call `resolveRange(context, key)` in any hook from `preprocessMetadata` on. It returns line objects, warns about numbers outside the block, and fails the build for anything that is not a range. It counts the lines that readers see (own-line directives do not count), the same lines as Expressive Code's `{}` markers.
- Directives: declare each one in the plugin's `directives` property, keyed `code <name>` for `[!code <name>]` or by the bare name (`annotate`, `callout`). `placement` is `end` or `own`; `text: true` makes the directive take the text after it; `docs` feeds the directives reference page. The notation plugin removes them from the code and the copied text. Read them with `getDirectives(codeBlock, name)` in any hook from `preprocessMetadata` on. Each has `lines` (its target line, then `count - 1` more), `text`, `match` (the literal from `/text/`, already checked against the target line) and `args`.
- Render directive text with `inlineMarkdown(text)`, which returns hast nodes.
- Warnings and errors: `warn(context, message, lineInBlock?)` and `fail(context, message)`. Both name the file and the block. Unknown names and missing matches already warn in the notation plugin.
- Line objects stay valid when other plugins delete lines. Apply effects to the line objects, not to indexes.

### 4. Styles

- Classes start with `scb-<name>-`, data attributes with `data-scb-<name>`. `PREFIX` in `styles.ts` holds `scb`.
- Declare the feature's style settings in its own group, `codeblocks<Feature>` (for example `codeblocksFocus.blur`), with a `declare module '@expressive-code/core' { interface StyleSettings { codeblocksFocus: … } }` block in the feature file. Every colour is a `[dark, light]` pair; every size is a setting. Reference them with `cssVar('codeblocksFocus.blur')`.
- Type each setting as `UnresolvedStyleValue`. Settings that depend on options, such as one colour for each custom line state, can use dynamic keys: add an index signature to the group interface and build the `PluginStyleSettings` inside `pluginX()`. Call `cssVar(\`group.${key}\` as never)` for those. A resolver function gets `Parameters<StyleResolverFn>[0]` (`ResolverContext` has no `resolveSetting`), and the colour helpers (`setAlpha`, `mix`, `onBackground`, `ensureColorContrastOnBackground`) come from `@expressive-code/core`.
- Expressive Code shortens words in CSS variable names: `codeblocksFocus.opacity` becomes `--ec-codeblocksFocus-opa`, `…Background` becomes `…Bg`. Tests that match CSS must use the short names (`getCssVarName()` gives them).
- Reuse the shared settings where they fit: `codeblocks.accent`, `accentForeground`, `mutedForeground`, `focusRing` and the `popover…` settings. A resolver can read them: `({ resolveSetting }) => resolveSetting('codeblocks.accent')`.
- The core plugin already gives every `scb-` element a focus ring, stops transitions and animations of `scb-` elements (and their descendants) under reduced motion, hides `scb-no-print` in print, and styles `scb-sr-only` and `scb-float`.
- Add a contrast test for new colours in the feature's test, like `test/styles.test.ts`: text 4.5:1, bars, tints and outlines that carry meaning 3:1, against `#23262f`/`#24292e` (dark) and `#f6f7f9`/`#ffffff` (light).

### 5. Client module

Only if static HTML cannot do the job.

1. Write `src/client/<name>.ts`. Its default export runs when the loader imports the module and again on every `astro:page-load`, so it must skip elements it has already set up (for example with a `data-scb-ready` attribute). No top-level side effects.
2. The build (`tsdown.config.ts`) turns each top-level file in `src/client/` into `dist/client/scb-<name>.<hash>.js`, minified, with every import bundled in. Put shared browser helpers in `src/client/shared/`.
3. Add `jsModules: clientJsModules` to the plugin. The loader imports `scb-<name>` on pages where an element has `data-scb-<name>`. So the Expressive Code plugin must set that attribute on each block that needs the module, and only then. Do not use a `data-scb-<name>` attribute for anything else.
4. `test/client-modules.test.ts` fails if the module is over 3 kB gzipped.
5. Popovers and hover cards: give the element the `scb-float` class, keep it inside the block's `.expressive-code` element (it holds the theme variables; ARCHITECTURE Q8), and call `place(floating, anchor)` from `src/client/shared/position.ts` when it opens. Call the function it returns when it closes.
6. Read the current theme from `document.documentElement.dataset.theme` if the script needs it.

With `codeblocks()`, the integration emits the modules next to `ec.<hash>.js`. Without it, the loader carries the module sources and imports them from `blob:` URLs (DECISIONS.md).

### 6. Tests

- Unit tests in `packages/starlight-codeblocks/test/<name>.test.ts` with `render(markdown, options?, extraPlugins?)` from `test/render.ts`. It returns `{ html, copyText, warnings }`. Cover every attribute and directive, the copied text, the warnings, and that a block that does not use the feature renders the same with the feature off (`render(md, { <feature>: false })`).
- Playwright tests in `docs/e2e/<name>.test.ts`, against the example on the feature's docs page (`page.goto('./features/<name>/')`). Use the keyboard and the pointer, and check the `reduced-motion` project. `docs/e2e/client.test.ts` shows how to test browser code on its own routed origin.
- `pnpm test` builds the package first, because the tests read `dist/client`.
- Screenshots for the mockup comparison: build the docs, run `astro preview` in `docs/`, and use `agent-browser` (or Playwright). Set the theme with `document.documentElement.dataset.theme = 'dark'` or `'light'`. Scroll with `window.scrollTo({ top, behavior: 'instant' })`, because the mockup page and Starlight scroll smoothly. Save the files in the scratchpad.

### 7. Docs

Write `docs/src/content/docs/features/<name>.mdx` from the template in DOCS-SITE.md. Put each example in an `export const` and pass it to `<Example code={…} />`: MDX removes the indentation of lines in a JSX attribute expression, but not in an `export`. `md`, `markdown` and `mdx` blocks on the docs site do not read directives (`astro.config.mjs`), so the "Markdown" tab shows them as written. Link to other pages with absolute paths that start with `/starlight-codeblocks/`; the links validator rejects relative links. Run `pnpm lint:docs` and read the page against the checklist in WRITING-STYLE.md.

## Notes for later phases

### Copy text (Q3)

```ts
postprocessRenderedBlock({ codeBlock, renderData }) {
  const button = select('button[data-code]', renderData.blockAst);
  if (button) button.properties.dataCode = copyText(codeBlock).replace(/\n/g, '\x7F');
}
```

In the browser, change `button.dataset.code` (for example on placeholder input). The frames click handler reads it at click time.

### Sätteri plugins (Q2, Q5)

```ts
import { isSatteriProcessor } from '@astrojs/markdown-satteri';

function codeblocksIntegration(): AstroIntegration {   // src/integration.ts
  return {
    name: 'starlight-codeblocks',
    hooks: {
      'astro:config:setup'({ config, updateConfig, logger }) {
        const processor = config.markdown.processor;
        if (isSatteriProcessor(processor)) processor.options.mdastPlugins.push(codeSwitcher(logger), inlineHighlighting(logger));
        updateConfig({ vite: { plugins: [ecConfigOverride, clientAssets, clientAssetsBuild] } });
      },
    },
  };
}
```

- A container directive plugin must return a replacement node (or set `node.data`), otherwise `starlight-directives-restoration` turns it back into text.
- In `.md`, return `{ type: 'html', value }` for inline HTML. `{ raw }` is parsed as Markdown and gets wrapped in `<p>`.
- Report problems through the Astro logger. `ctx.report` is not shown.
- A plugin object is reused across compiles. Use a factory entry (`(ctx) => plugin`) for per-document state.

### MDX components (Q6)

```astro
---
import { fromHtml } from 'hast-util-from-html';
import { selectAll } from 'hast-util-select';
import { toKeyedTokens, syncTokenKeys } from '@shikijs/magic-move/core';
const html = await Astro.slots.render('default');
const blocks = selectAll('.expressive-code', fromHtml(html, { fragment: true }));
// per block: walk '.ec-line .code' text nodes, join ancestor span styles into htmlStyle,
// then toKeyedTokens(code, lines) and syncTokenKeys(previous, current).to
---
<div data-steps={JSON.stringify(steps)}><Fragment set:html={html} /></div>
<script>
  import { MagicMoveRenderer } from '@shikijs/magic-move/renderer';
</script>
```

Keep the rendered blocks in the page for the no-JavaScript view.
