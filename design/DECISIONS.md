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
