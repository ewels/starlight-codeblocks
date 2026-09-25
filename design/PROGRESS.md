# Progress

Update this file after each step in `PLAN.md`. Use one of these states: not started, in progress, done, blocked. When the plan is complete, add a summary at the top: what is done, what is blocked and why, and what a person needs to check first.

| Step | State | Notes |
|---|---|---|
| 0.1 If main has no commits, commit the design pack, AGENTS.md,… | done | main already had the design pack commits (f624beb, 7f19da9), pushed. |
| 0.2 Create the branch main, and push it | done | Stale row: main exists and is the work branch (see DECISIONS.md). |
| 1.1 Work through ARCHITECTURE-QUESTIONS.md with small throwaway… | done | Real Astro 7.3.5 / Starlight 0.42.4 / EC 0.44.2 / Sätteri 0.10.5 site in the scratchpad, not committed. |
| 1.2 Write the answers to design/ARCHITECTURE.md | done | All nine answered. No step blocked. Phase 10 is feasible (Q5). Code switcher is a directive (Q2). Step 3.3 must also settle client files for preset-only sites (Q4). |
| 2.1 Create the pnpm workspace: packages/<name> (TypeScript, ESM, built… | done | pnpm workspace, tsdown package with `.` and `./expressive-code` exports, Starlight docs site. Biome and TypeScript 6 (see DECISIONS.md). Docs build is warning-free. |
| 2.2 Set up Vitest with a render helper that runs a Markdown code block… | done | `test/render.ts`: `render(markdown)` renders one fenced block with `ExpressiveCode` (default plugins, so frames and the copy button are there) plus `pluginCodeblocks()`, and returns `{ html, copyText }`. Extend it with plugin options in 3.1. |
| 2.3 Set up Playwright against a production build of the docs site,… | done | Playwright in `docs/` (Chromium). Projects: desktop-light, desktop-dark, phone-light, phone-dark (360 px), reduced-motion (desktop, dark). `astro preview --ignore-lock` serves `dist/`; root `pnpm test:e2e` builds first, `pnpm --filter docs test:e2e` reuses the build. |
| 2.4 Write scripts/lint-docs.mjs from the rules in WRITING-STYLE.md,… | done | `scripts/lint-docs.mjs` with `node --test` tests in `scripts/lint-docs.test.mjs`. Pass file paths to lint other files. Skips "key" and "essential" (see DECISIONS.md). |
| 2.5 Add a CI workflow that runs lint, unit tests, both builds and the… | done | `.github/workflows/ci.yml`: one job on Node 22 (lint, lint:docs, test, docs:build, Playwright Chromium). Actions pinned to SHAs with actions-up; zizmor clean. Not run yet (needs a push). The GitHub Pages deploy workflow from DOCS-SITE.md is not written yet: it would run on every push to `main`, so add it with phase 12. |
| 2.6 Build the docs site's page skeleton from DOCS-SITE.md, including… | done | All sidebar pages from DOCS-SITE.md as "Not yet written" placeholders, sidebar in order, `starlight-links-validator` (ignores `#mention:`), `Example` component (checked by hand on a temporary page). Plugin features in `Example` need the `<Code>` route from step 3.1. |
| 3.1 Options: the codeblocks(options) Starlight plugin, the… | done | `src/options.ts` (types, validation, `optionsReference`), `src/registry.ts`, `src/index.ts` (Q1 route: hidden plugins + `ec-config` override, build error when `ec.config.mjs` has `plugins` without the preset), `src/integration.ts`. `render(markdown, options)` returns `{ html, copyText, warnings }`. Root `lint` and `test` build first (fixes CI on a fresh clone). |
| 3.2 The range parser and the comment notation parser, with the comment… | done | `ranges.ts` (`parseRange`), `comments.ts` (syntax map), `notation.ts` (`parseLine`, `parseNotation`, `pluginNotation`, `getDirectives`), `core.ts` (`resolveRange`, `warn`, `fail`, `numberedLines`), `inline-markdown.ts`. `[!code highlight]`, `++` and `--` work. Expressive Code ranges count visible lines (see DECISIONS.md). |
| 3.3 The client module loader, so that each page loads only the modules… | done | `src/client-modules.ts` (`readClientModules`, `loaderSource`, `clientJsModules`), client Vite plugins in `src/integration.ts`, per-module tsdown builds, `src/client/shared/position.ts` (`place`). Preset-only sites get an inline loader with `blob:` imports (see DECISIONS.md). Checked by hand in `astro dev` and `astro preview` with a temporary module; Playwright tests on a routed origin cover both loader modes and both positioning paths. No feature module exists yet, so the docs pages load no client JavaScript. |
| 3.4 Style settings and theme handling: the shared tokens, light and… | done | `src/expressive-code/styles.ts`: `codeblocks` style settings group (dark and light pairs), base styles for `scb-float`, `scb-sr-only`, `scb-no-print`, focus ring and reduced motion. Prefix `scb`. Contrast test in `test/styles.test.ts`. |
| 3.5 Docs: the getting started page, the configuration reference page… | done | Getting started, Configuration, Comment notation (feature template), Options and Directives reference pages (tables generated from the source). Playwright test for the comment notation examples, including the copied text. `pnpm lint:docs` passes; pages read against the WRITING-STYLE checklist. ARCHITECTURE.md has a "How to add a feature" section. |
| 4.1 Focus | done | `src/expressive-code/focus.ts`, CSS only (no client module). `tabindex` goes on `pre > code` (DECISIONS.md). Unit tests, Playwright tests (pointer, keyboard, reduced motion, copy), docs page. Screenshots match the mockup in both themes. |
| 4.2 Line states, including custom states | done | `src/expressive-code/line-states.ts`: built-in and custom states, messages as labels, hidden prefixes, derived colours with a contrast test. Name rules in `options.ts`. Docs site defines `todo`. Playwright tests check the copied text and a manual selection. ARCHITECTURE.md guide updated with what 4.1 and 4.2 taught. |
| 4.3 Word-level diff | done | `src/expressive-code/word-diff.ts`: pairs `del`/`ins` runs by reading text-markers' own line annotations, tokenises with a word/whitespace/punctuation split, highlights the LCS-changed ranges with `ExpressiveCodeAnnotation`, no client module. Covers `diff` blocks, `ins`/`del` attributes and `[!code ++/--]`. Unit tests, contrast test, docs page. |
| 4.4 Visible whitespace | done | `src/expressive-code/whitespace.ts`: leading-only or `whitespace="all"`, dot and arrow glyphs via an `aria-hidden` marker element over the real character, no client module. Found and fixed a platform issue: `astro-expressive-code` expands tabs to spaces by default, so the docs site now sets `expressiveCode: { tabWidth: 0 }` (DECISIONS.md). Unit tests, docs page. |
| 4.5 Colourised brackets | done | `src/expressive-code/brackets.ts`: language-agnostic string/comment scanner pairs brackets by depth, `ExpressiveCodeAnnotation` per bracket. First feature with a client module (`src/client/brackets.ts`, hover outline of the partner, 0.29 kB gzipped, well inside the 3 kB budget); confirmed the loader end to end after finding a missing `jsModules: clientJsModules` wiring. Unit tests, contrast test, Playwright hover/reduced-motion tests, docs page. |
| 4.6 Hidden lines | not started | |
| 4.7 Expandable blocks | not started | |
| 5.1 Inline callouts | not started | |
| 5.2 Annotations | not started | |
| 5.3 Footnotes, including the sticky option | not started | |
| 5.4 Side-by-side annotations | not started | |
| 5.5 Docs: the guide that helps authors choose between callouts,… | not started | |
| 6.1 Smart shell copy | not started | |
| 6.2 Open in playground, with the two built-in playgrounds and the… | not started | |
| 6.3 Token links | not started | |
| 6.4 Fill-in placeholders, including playground links | not started | |
| 7.1 Line permalinks | not started | |
| 7.2 Code mentions | not started | |
| 7.3 Code switcher | not started | Sätteri directive route confirmed (ARCHITECTURE.md Q2). |
| 8.1 Token transitions | not started | |
| 8.2 Scrollycoding | not started | |
| 9.1 The adapter interface, the hover card and the build-time cache for… | not started | |
| 9.2 The Python adapter, with the standard library inventory and… | not started | |
| 9.3 The Nextflow adapter, with the bundled channel and operator map… | not started | |
| 9.4 Docs: the feature page and a guide to writing an adapter | not started | |
| 10.1 Inline code highlighting, through the hook the spike found | not started | Hook found: async mdast inlineCode visitor (ARCHITECTURE.md Q5). Not blocked. |
| 11.1 The runtime interface, the Run button and the output panel | not started | |
| 11.2 The Pyodide runtime, in a web worker | not started | |
| 11.3 Docs: the feature page and a guide to adding a runtime | not started | |
| 12.1 Complete every docs page | not started | |
| 12.2 Write the migration guide for VitePress users | not started | |
| 12.3 Write the package README: what it is, the one-line install and… | not started | |
| 12.4 Fill in package.json: description, keywords (include withastro,… | not started | |
| 12.5 Final review | not started | |
| 12.6 Return to any blocked steps | not started | |
