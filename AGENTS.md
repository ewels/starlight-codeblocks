# Agent instructions

These rules apply to every session in this repository.

## The project

`starlight-codeblocks` is a Starlight plugin that adds 24 code block features (focus, line states, comment notation, annotations, API auto-linking and more) on top of Expressive Code, which already renders every code block in Starlight. The first release is built. `packages/starlight-codeblocks/` is the plugin, `docs/` is its Starlight docs site (it uses the plugin through `workspace:*`), and `skills/starlight-codeblocks/` is an agent skill for people who use the plugin.

`.agents/` holds the notes for agents that work on the repository:

- `ARCHITECTURE.md`: how to add a feature, and the platform facts the design depends on. Read it before you write plugin code.
- `DECISIONS.md`: design decisions and the options that were rejected. Search it before you change existing behaviour.
- `WRITING-STYLE.md`: how the docs read, the feature page template and the glossary.

The docs site defines the syntax and behaviour of each feature.

## Stack

- Astro 7, Starlight 0.42 or later, Expressive Code 0.44 or later, Node 22.12 or later, pnpm 11 workspace.
- TypeScript for all package source. No front-end framework in client code. Biome for code lint.
- Sätteri, the Astro 7 default Markdown processor. It does not run remark or rehype plugins. The docs site stays on Sätteri: do not add remark or rehype plugins to it, and do not switch it to `unified()`. The package builds its Markdown features as Sätteri plugins, and registers the same plugins through a small remark adapter on sites that use `unified()`.
- Check the latest version on npm (`npm view <pkg> version`) before you add or bump a dependency.

## Commands

```
pnpm install
pnpm build              Build the package (tsdown) into packages/starlight-codeblocks/dist
pnpm test               Build, then Vitest unit tests and the node:test checks in scripts/
pnpm lint               Build, then Biome and type checks (tsc, astro check)
pnpm lint:docs          Writing-style lint for docs/, the READMEs and skills/
pnpm docs:build         Build the package and the docs site into docs/dist
pnpm test:e2e           docs:build, then Playwright against astro preview of docs/dist
pnpm readme:media [slug...]   docs:build, then regenerate the README images in .github/assets/readme/
```

- Docs dev server: `pnpm build && pnpm --filter docs dev`. The docs site imports the package from `dist`, so rebuild the package after each change to it.
- One Vitest file or test: `pnpm --filter starlight-codeblocks exec vitest run test/focus.test.ts -t "blur"`. The tests read `dist/client`, so run `pnpm build` first after you change client code.
- One Node script test: `node --test scripts/examples.test.mjs`.
- One Playwright spec or project, against an existing `docs/dist`: `pnpm --filter docs exec playwright test e2e/focus.test.ts --project=desktop-dark`. The projects are `desktop-light`, `desktop-dark`, `phone-light`, `phone-dark` and `reduced-motion`. The preview server uses port 4329; set `SCB_E2E_PORT` to use another port, for example when another session runs a preview.

## Architecture

### Registration

- `codeblocks()` (`src/index.ts`) is the Starlight plugin. In `config:setup` it validates the options (`src/options.ts`), stores the options and the real Expressive Code plugin objects in a `globalThis` registry (`src/registry.ts`), and adds the Astro integration (`src/integration.ts`).
- The plugin objects that go into Starlight's `expressiveCode.plugins` hide every property except `name`, so that `astro-expressive-code` can serialise its config. The integration also resolves `virtual:astro-expressive-code/ec-config` to its own module, which merges the author's `ec.config.mjs` with the real plugins, so that `<Code>` gets them too.
- If a site's `ec.config.mjs` has a `plugins` key, that array replaces Starlight's. The author must add `pluginCodeblocks()` to it, and the build fails with that fix if it is missing. Plugin names start with `starlight-codeblocks:`, which is how `codeblocks()` finds them.

### Expressive Code plugins

- `createPlugins()` in `src/expressive-code/index.ts` is the preset, in order. `pluginCore()` comes first and `pluginNotation()` second, so that later features can read directives. The comments in that function give the other order constraints (for example callouts, annotations and footnotes come last). Each feature is `src/expressive-code/<name>.ts`.
- Comment notation (`notation.ts`) parses `[!code …]` and bare directives such as `[!annotate]` in `preprocessLanguage`, removes them from the code and the copied text in `preprocessCode`, and maps `{}` markers to the lines that readers see. Features declare their directives in their plugin's `directives` property and read them with `getDirectives()`. Ranges on the fence line go through `resolveRange()`.
- The core plugin records each line's rendered element. Find a line with `lineElement(line)` and insert with `insertBefore()`. Never index `.ec-line` elements, because other plugins (collapsible sections, twoslash) add or move lines.
- Every element a feature adds that is not code gets the `scb-deco` class and `data-pagefind-ignore`, from the list in `core.ts`. The text of a block without its decorations must equal the copied text (`test/decorations.test.ts`).
- Classes start with `scb-`, data attributes with `data-scb-`. Every colour is a style setting (`[dark, light]` pair or a resolver), in the shared `codeblocks` group or the feature's `codeblocks<Feature>` group. Floating elements must stay inside the block's `.expressive-code` element, which carries the theme variables.

### Markdown plugins

`src/satteri/index.ts` defines one Sätteri mdast plugin: the `:::code-switcher` directive, `{:lang}` inline highlighting (`inline-code.ts`, with an Expressive Code engine that uses the site's themes), code mention link checks and the duplicate block `id` check. The integration pushes it to `mdastPlugins` on Sätteri. On `unified()` it pushes `remarkFromSatteri()` (`remark.ts`), which runs the same definition over the remark tree; if a plugin needs more of Sätteri's context, add it there with a case in `test/remark.test.ts`.

### Client code

- Each interactive feature has a module in `src/client/<name>.ts`, built to `dist/client/scb-<name>.<hash>.js`. One loader, in every plugin's `jsModules`, imports `scb-<name>` only on pages where an element has `data-scb-<name>`. The API card is the exception: other plugins put `data-scb-api-*` links outside code blocks, on pages with no `ec.<hash>.js`, so the integration also injects a page script for it, and serves its styles as page CSS (`src/api-card-page.ts`). The integration emits the modules next to `ec.<hash>.js`. On sites that use the preset without `codeblocks()`, the loader carries the sources and imports them from `blob:` URLs.
- `test/client-modules.test.ts` fails if a module is over 3 kB gzipped.
- Modules must work in `cloneNode(true)` copies of a block (full screen plugins): listen on the document and find targets with `closest()`, not by id.

### Components, adapters and runtimes

- `<CodeWalkthrough>` and `<Scrollycoding>` (`src/components/`, shipped as source through `starlight-codeblocks/components`) read tokens from the HTML that Expressive Code rendered and animate with `@shikijs/magic-move/renderer`. They use their own Astro `<script>`.
- API link adapters are subpath exports in `src/adapters/` (`python`, `nextflow`). Run button runtimes are in `src/runtimes/` (`pyodide`). The docs site has its own adapter and JavaScript runtime in `docs/src/adapters/` and `docs/src/runtimes/`.
- Reference data for the docs tables lives in the package: `optionsReference` (`options.ts`), the `directives` of each plugin, and `attributesReference` and `styleSettingsReference` (`src/reference.ts`). `test/reference.test.ts` fails when a new attribute or style setting is missing from it.

### Docs site

- `docs/src/sidebar.mjs` is the single source for the sidebar, the home page carousel, `llms.txt`, `llms-full.txt` and the Markdown routes (`docs/src/markdown.ts`). A page that is not in it fails the build.
- `docs/src/components/Example.astro` shows "Readers see" (the rendered output) above "You write" (the Markdown), both visible. It renders each fenced block with `<Code>`; for prose, directives or components, put the same Markdown between the tags as a live slot.
- `docs/src/pages/[...slug].md.ts` serves a Markdown version of each page, `og/[...slug].ts` renders the share cards, `Head.astro` adds `og:image` and the Markdown link, and `route-data.ts` adds headings that components write to the table of contents.
- Options, directives, attributes, style settings and comment syntax tables are generated from the package's reference data.

### Agent skill

`skills/starlight-codeblocks/` is at the repository root, so that `npx skills add ewels/starlight-codeblocks` finds it. `prepack` copies it into the package (the copy is gitignored); never document the `node_modules` path. `guides/agent-skill.mdx` renders the skill files with `?raw` imports. `test/skill.test.ts` fails if a feature page, attribute, directive or option is missing from the skill. When you add or change a feature, update the skill.

## Gotchas

- `README.md` at the root and `packages/starlight-codeblocks/README.md` must be identical (a test checks). Copy with `/bin/cp -f README.md packages/starlight-codeblocks/`: `cp` is an alias for `cp -i` in this shell and waits for an answer.
- `docs:build` deletes `docs/node_modules/.astro` first, because Astro's content cache otherwise serves stale HTML after a plugin change. Rebuild the docs after package changes before you run e2e tests.
- Links between docs pages must be absolute and start with the base, `/starlight-codeblocks/`. starlight-links-validator rejects relative links.
- Put each `<Example>` source in an `export const` in the page. MDX removes indentation inside a JSX attribute expression, but not in an `export`.
- Drift checks in `scripts/examples.test.mjs`: a live `<Example>` slot must match its source, and each home page carousel slide must equal its feature page's first `<Example>` (with `hiddenAttributes` applied). Update both together.
- Each docs example shows only its own feature. If another feature starts on its own (word-level diff, API links), pick other code or turn it off with `hiddenAttributes`, not in the visible source (a test checks). Combine features only in an example that says it is a combination.
- `md`, `markdown` and `mdx` blocks on the docs site do not read directives, so "You write" shows them as written.
- Inline highlighting: document the form inside the backticks, `` `fetch(url){:js}` ``. After the backtick, `{:js}` is a JavaScript expression in MDX, so it needs `\{:js}`.
- Never use `instanceof` on Expressive Code classes. `<Code>` renders through a second copy of `@expressive-code/core`, so the check fails there and passes in unit tests. Use the core's type guards.
- When a feature changes how text looks, test the computed style of the element that draws the glyph in Playwright. Expressive Code's token spans set their own `color`.
- Commits are signed with SSH through 1Password. If signing fails, 1Password is probably locked; do not retry in a loop.

## Quality gates

Every commit must pass `pnpm lint`, `pnpm test` and `pnpm docs:build` with no warnings. Run `pnpm lint:docs` before each push. CI runs the full e2e suite, so locally run only the Playwright specs for what you changed. For a visual change, check a Playwright screenshot of the docs example in the dark and the light theme. Put screenshots and experiments in a scratch folder, not in the repository.

## Accessibility

All features meet WCAG 2.2 AA in the light and the dark Starlight themes:

- Every interaction works with a keyboard, with a visible focus indicator.
- Colour never carries meaning alone.
- Motion stops under `prefers-reduced-motion: reduce`.
- Screen readers get the same information as sighted readers.

## Writing

Every word in `docs/`, the README, `skills/` and package descriptions follows `.agents/WRITING-STYLE.md`. Code comments and commit messages use British English and plain language.

## Git

- Commit messages are `<area>: <what changed>`, for example `focus: add blur and dim styles`.
- Never create tags or releases. Never publish to npm. Never force-push. Never rewrite history on a pushed branch.

## Decisions

Record each design decision that the code does not explain in `.agents/DECISIONS.md`, in the right section, with the reason and the rejected alternatives. Keep entries short, and replace an entry when a decision changes rather than adding a new one.

## Do not

- Add a runtime dependency without an entry in `.agents/DECISIONS.md`.
- Load client JavaScript on pages that do not use the feature it belongs to.
- Build snippet import or an Ask AI button. Both were considered and dropped.
