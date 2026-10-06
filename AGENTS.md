# Agent instructions

`starlight-codeblocks` is a Starlight plugin that adds 26 code block features on top of Expressive Code (EC), which renders every code block in Starlight. `packages/starlight-codeblocks/` is the plugin, `docs/` its Starlight docs site (it uses the plugin through `workspace:*`, and defines each feature's syntax and behaviour), `examples/astro/` a minimal Astro site without Starlight, and `skills/starlight-codeblocks/` an agent skill for people who use the plugin.

- `.agents/DECISIONS.md`: design decisions and the rejected options. Search it before you change existing behaviour.
- `.agents/WRITING-STYLE.md`: how the docs read, the feature page template and the glossary.

## Stack

- Astro 7, Starlight 0.42+, Expressive Code 0.44+, Node 22.12+, pnpm 11 workspace. TypeScript for all package source, no front-end framework in client code, Biome for lint.
- Sätteri is Astro 7's Markdown processor and runs no remark or rehype plugins. The docs site stays on Sätteri. The package's Markdown features are Sätteri plugins, with a remark adapter for sites on `unified()`.
- Check the latest version on npm (`npm view <pkg> version`) before you add or bump a dependency.

## Commands

```
pnpm install
pnpm build              Build the package (tsdown) into packages/starlight-codeblocks/dist
pnpm test               Build, then Vitest unit tests, a build of examples/astro and the node:test checks in scripts/
pnpm lint               Build, then Biome and type checks (tsc, astro check)
pnpm lint:docs          Writing-style lint for docs/, the READMEs and skills/
pnpm docs:build         Build the package, the docs site into docs/dist and examples/astro into docs/dist/examples/astro, then render the share cards
pnpm test:e2e           docs:build, then Playwright against astro preview of docs/dist
pnpm readme:media [slug...]   docs:build, then regenerate the README images in .github/assets/readme/
```

- Docs dev server: `pnpm build && pnpm --filter docs dev`. The docs import the package from `dist`, so rebuild after each package change.
- One Vitest test: `pnpm --filter starlight-codeblocks exec vitest run test/focus.test.ts -t "blur"`. Tests read `dist/client`, so build first after client changes.
- One script test: `node --test scripts/examples.test.mjs`.
- One Playwright spec against an existing `docs/dist`: `pnpm --filter docs exec playwright test e2e/focus.test.ts --project=desktop-dark`. Projects: `desktop-light`, `desktop-dark`, `phone-light`, `phone-dark`, `reduced-motion`. Port 4329, or set `SCB_E2E_PORT`.

## Where things live

Paths are under `packages/starlight-codeblocks/src/` unless they start with `docs/`.

- `index.ts`: `codeblocks()`, the Starlight plugin. It validates options (`options.ts`), fills the `globalThis` registry (`registry.ts`) and adds the integration (`integration.ts`).
- `astro.ts`: `codeblocks()` for Astro without Starlight (`starlight-codeblocks/astro`). It does the same and adds `astroExpressiveCode()` itself. `examples/astro/` uses it: `pnpm build && pnpm --filter example-astro build`.
- `expressive-code/index.ts`: `createPlugins()`, the preset in order. Core first, notation second; the comments there give the other order constraints. One file per feature, `expressive-code/<name>.ts`. Shared helpers are in `core.ts` and `styles.ts`.
- `satteri/`: one mdast plugin for code tabs directive, `{:lang}` inline code, mention link checks and duplicate `id` checks. `remark.ts` runs it on `unified()`; add any context it lacks there, with a case in `test/remark.test.ts`.
- `client/<name>.ts`: browser modules, built to `dist/client/scb-<name>.<hash>.js` and loaded by one loader in `jsModules`. `api-card-page.ts` is the exception: a page script and CSS for API cards on links outside code blocks.
- `components/`: `<CodeWalkthrough>` and `<Scrollycoding>`, shipped as source. They read tokens from EC's rendered HTML and animate with magic-move's renderer.
- `adapters/` (`python`, `nextflow`) and `runtimes/` (`pyodide`, `javascript`, `typescript`): subpath exports. The docs site has its own adapters in `docs/src/adapters/`.
- `reference.ts`, `optionsReference` and each plugin's `directives`: the data behind the docs reference tables.
- `scripts/og-cards.mjs`: the share cards in `docs/dist/og/`. It screenshots the first example (else the first code block) of each built page in Chromium and sets it in the card. The home page card is a wall of the feature examples.
- `docs/src/sidebar.mjs`: the single source for the sidebar, the carousel, `llms.txt` and the Markdown routes. A page not in it fails the build.
- `docs/src/components/Example.astro`: "Readers see" above "You write". It renders fenced blocks with `<Code>`; for prose, directives or components, put the same Markdown between the tags as a live slot.
- `skills/starlight-codeblocks/`: at the root so that `npx skills add` finds it. `prepack` copies it into the package; never document the `node_modules` path. Update it with every feature change (`test/skill.test.ts` checks).

## How to add a feature

`<feature>` is the option key (`lineStates`), `<name>` the file name (`line-states`). `expressive-code/focus.ts` is the smallest complete example.

Options:

- Add the key to `CodeblocksOptions` and `optionsReference`, with a test in `test/options.test.ts`.
- A feature with settings takes `false` or an object. One without takes only `false`.

The EC plugin:

- `pluginX(settings)` returns a `CodeblocksPlugin` named `starlight-codeblocks:<name>`. Add it to `createPlugins()` behind `options.<feature>` and export it.
- Keep per-block state in `AttachedPluginData`, never on `codeBlock.props`.
- Ranges: `resolveRange(context, key)`, in `preprocessCode`, after the frames plugin removes the file name comment. Ranges count the lines that readers see, from 1.
- Directives: declare them in the plugin's `directives`, with `placement`, `text` and `docs`. Read them with `getDirectives()` and render their text with `inlineMarkdown()`.
- `warn(context, message, line?)` for bad input: it warns and renders without the effect. Only a malformed range fails the build.
- Apply effects to line objects, never to indexes. Find a rendered line with `lineElement(line)` and insert with `insertBefore()`. Never index `.ec-line`: other plugins add and move lines.
- Extra nodes never change the copied text. Add each decoration to the `scb-deco` list in `core.ts`, with `user-select: none`. `test/decorations.test.ts` checks that a block without its decorations reads as its copied text. Screen reader text goes in `scb-sr-only`.
- Title bar controls go through `addTitleBarControl()`. A control that needs JavaScript gets `scb-needs-js`.
- Anything in `code` that lines up with the text adds `var(--scb-gutter, 0px)`. For focusable code, put `tabindex="0"` on `pre > code`, because EC's script removes it from a `pre` that does not scroll.

Styles:

- Classes start with `scb-`, data attributes with `data-scb-`.
- Settings go in a `codeblocks<Feature>` group, declared with `declare module '@expressive-code/core'` in the feature file, typed `UnresolvedStyleValue`, and read with `cssVar()`.
- Every colour default is a resolver from a theme colour, corrected to its contrast target with `themeColour()` and `onCode()`. Never hex. Targets: text 4.5:1; bars and outlines that carry meaning 3:1. Add contrast tests across the shared test themes.
- EC shortens CSS variable names (`Background` becomes `Bg`), so tests use `getCssVarName()`.
- Never restyle what EC draws: frame, title bar, fonts, copy button, text markers.
- Describe new settings and attributes in `reference.ts`; `test/reference.test.ts` checks.

Client module, only when static HTML cannot do the job:

- The default export runs on import and on every `astro:page-load`, so skip elements already set up (`data-scb-ready`). No top-level side effects.
- Add `jsModules: clientJsModules`, and set `data-scb-<name>` only on blocks that need the module.
- Stay at or under 3 kB gzipped (`test/client-modules.test.ts`). Helpers go in `client/shared/` and are bundled in. No shared chunks: they break the `blob:` loader that sites without `codeblocks()` use.
- Work in `cloneNode(true)` copies (full screen plugins): listen on the document and find targets with `closest()`, never by id. `swapInto()` handles copies that switch content.
- Popovers stay inside the block's `.expressive-code`, which holds the theme variables. Use `scb-float` with `place()`, `follow()` or `below()`.
- To reach a hidden line, call `unhide()`. It opens tabs and `<details>` and sends `beforematch` for each feature to handle.
- For placeholder values, read `data-code` when you need it, and listen for `scb-placeholders-change`.

Tests and docs:

- `render(markdown, options?, extraPlugins?)` from `test/render.ts` returns `{ html, copyText, warnings }`. Cover every attribute and directive, the copied text and the warnings. Check that a block that does not use the feature is unchanged with it off. Tests have no network (`test/setup.ts`).
- Playwright goes against the feature's docs page: keyboard, pointer and `reduced-motion`. Set the theme with `document.documentElement.dataset.theme`.
- Write the page from the template in WRITING-STYLE.md, and update the skill.

## Platform facts

These come from reading the installed source. Check them again after a major upgrade.

- `astro-expressive-code` serialises its options and writes functions as `"[Function]"`, so `<Code>` throws on real plugin objects. The plugin therefore hides every property but `name`, and overrides `virtual:astro-expressive-code/ec-config` to hand `<Code>` the real plugins.
- `ec.config.mjs` `plugins` replaces Starlight's list (arrays are not merged). The author must add `pluginCodeblocks()`, and the build fails with that fix until they do.
- EC expands tabs before any hook runs (so `codeblocks()` sets `tabWidth: 0`), and trims line ends in its constructor (so trailing whitespace travels in a hidden `scbTrailing` fence attribute).
- Code edits are allowed only from `preprocessCode`. The frames plugin writes `button[data-code]` (newlines as `\x7F`) in `postprocessRenderedBlock`, before ours, and reads it at click time.
- `jsModules` land in one `ec.<hash>.js`, only on pages with code blocks. It is an emitted asset, so bare `import()` specifiers in it are not resolved. In dev, read `import.meta.url` into a variable, or Vite rewrites it. `injectScript('page')` loads on every page.
- The second theme's variables apply only inside `.expressive-code`. Anything outside a block needs its own stylesheet, built from the engine's `styleVariants` through a virtual module in `customCss`.
- Sätteri: a container directive plugin must return a replacement node, or Starlight turns it back into text. `ctx.report` is not shown, so warn through the logger. Plugin objects are reused across documents, so use a factory for per-document state. `textContent()` skips raw HTML, so return hast.
- `<Code>` renders through a second copy of `@expressive-code/core`, so `instanceof` fails there and passes in unit tests. Use the core's type guards.
- magic-move sets a unitless `--smm-stagger: 0`, which breaks its delays, so the plugin sets `0ms`.
- starlight-links-validator collects ids before EC renders, hence `linksValidatorExclude()`.

## Gotchas

- The root `README.md` and `packages/starlight-codeblocks/README.md` must be identical (a test checks). Copy with `/bin/cp -f`, because `cp` is aliased to `cp -i`.
- `docs:build` deletes `docs/node_modules/.astro`, because the content cache serves stale HTML after a plugin change. Rebuild the docs before e2e tests.
- Links between docs pages are absolute, from `/starlight-codeblocks/`. The links validator rejects relative links.
- Put each `<Example>` source in an `export const`. MDX removes indentation inside a JSX attribute expression.
- `scripts/examples.test.mjs`: a live `<Example>` slot must match its source, and each carousel slide must equal its page's first `<Example>`. Update both together.
- Each docs example shows only its own feature. Turn off features that start on their own (word-level diff, API links) with `hiddenAttributes`, not in the visible source.
- `md`, `markdown` and `mdx` blocks on the docs site do not read directives.
- Document inline code as `` `fetch(url){:js}` ``. After the backtick, `{:js}` is an MDX expression and needs `\{:js}`.
- When a feature changes how text looks, test the computed style of the element that draws the glyph. EC's token spans set their own `color`.
- Commits are signed through 1Password. If signing fails, it is probably locked; do not retry in a loop.

## Releasing

Only a maintainer releases. The npm trusted publisher may only stage a version, so each release needs the maintainer's 2FA.

1. Set `version` in `packages/starlight-codeblocks/package.json` and add a `CHANGELOG.md` entry. Commit, push, and wait for CI to pass.
2. Create a GitHub release with tag `vX.Y.Z` on that commit and the CHANGELOG entry as notes. `publish.yml` checks that the tag matches the version, runs `pnpm test` and runs `npm stage publish`.
3. Approve it: `npm stage list starlight-codeblocks`, then `npm stage approve <id>`. `npm stage reject <id>` drops it and frees the version.

A prerelease (`1.1.0-beta.1`) needs `--tag next` on `npm stage publish`.

## Rules

- Every commit passes `pnpm lint`, `pnpm test` and `pnpm docs:build` with no warnings. Run `pnpm lint:docs` before each push. For a visual change, check a screenshot in the dark and the light theme. Screenshots and experiments go in a scratch folder.
- Accessibility is WCAG 2.2 AA in both Starlight themes:
  - Every interaction works with a keyboard, with a visible focus indicator.
  - Colour never carries meaning alone.
  - Motion stops under `prefers-reduced-motion: reduce`.
  - Screen readers get the same information as sighted readers.
- The docs, README, skill and package descriptions follow `.agents/WRITING-STYLE.md`. Code comments and commit messages use British English and plain language.
- Commit messages are `<area>: <what changed>`. Never tag, release, publish to npm, force-push or rewrite pushed history.
- Record design decisions that the code does not explain in `.agents/DECISIONS.md`, including every new runtime dependency. Keep entries short, and replace an entry when a decision changes.
- Never load client JavaScript on pages that do not use its feature.
- Do not build snippet import or an Ask AI button. Both were considered and dropped.
