# Agent instructions

Read this file first, then `design/README.md`. These rules apply to every session in this repository.

## The project

This repository builds a Starlight plugin that adds advanced code block features: focus, line states, comment notation, annotations, API auto-linking and 19 more. The plugin builds on Expressive Code, which already renders every code block in Starlight.

The design pack in `design/` defines what to build. `design/SPEC.md` defines behaviour and syntax. `design/mockups.html` shows how each feature looks and feels. Open the mockups in a browser (or with Playwright) before you build a feature.

The working name in the design pack is `starlight-codeblocks`. The real package name is the repository name. Get it from `git remote get-url origin`. Use the real name everywhere you write it: package, docs, examples and README.

## Stack

- Astro 7, Starlight 0.42 or later, Expressive Code 0.44 or later.
- Sätteri, the Astro 7 default Markdown processor. Sätteri does not run remark or rehype plugins. Do not add remark or rehype plugins, and do not switch the docs site to `unified()`.
- Node 22 or later, and a pnpm workspace.
- TypeScript for all package source. No front-end framework in client code.

Check current versions on npm before you pin a dependency. The versions in the design pack were current on 25 September 2026: Astro 7.3.5, Starlight 0.42.4, Expressive Code 0.44.2, `@astrojs/markdown-satteri` 0.4.2, `@shikijs/magic-move` 4.4.3, Pyodide 314.0.7, Playwright 1.63.0, Vitest 5.0.2.

A copy of the `starlight-docs` skill is in `design/reference/starlight-docs/`. If the skill is installed, use the installed copy. Read its `references/expressive-code.md` and `references/markdown-pipeline.md` before you write plugin code.

## Repository layout

```
packages/<name>/        The plugin package
docs/                   Starlight docs site that uses the plugin through workspace:*
design/                 Design pack (see design/README.md)
scripts/                Repository scripts, such as the docs linter
.github/workflows/      CI
```

## Commands

Set these up in the scaffold step, then keep them working:

```
pnpm install
pnpm test               Unit tests (Vitest) for the plugin
pnpm test:e2e           Playwright tests against the built docs site
pnpm build              Build the plugin package
pnpm docs:build         Build the docs site
pnpm lint               Type checks and code lint
pnpm lint:docs          Writing-style lint for the docs (see design/WRITING-STYLE.md)
```

## Git

- Make one commit for each completed step in `design/PLAN.md`. A step can have more than one commit if it is large.
- Write commit messages as `<area>: <what changed>`, for example `focus: add blur and dim styles`.
- Push `main` at the end of each phase.
- Never create tags or releases. Never publish to npm. Never force-push. Never rewrite history on a pushed branch.

## Quality gates

Every commit must pass `pnpm lint`, `pnpm test` and `pnpm docs:build` with no warnings. Run `pnpm test:e2e` and `pnpm lint:docs` before each push.

## Accessibility

All features meet WCAG 2.2 AA in the light and the dark Starlight themes:

- Every interaction works with a keyboard, with a visible focus indicator.
- Colour never carries meaning alone.
- Motion stops under `prefers-reduced-motion: reduce`.
- Screen readers get the same information as sighted readers.

## Writing

Every word in `docs/`, the README and package descriptions follows `design/WRITING-STYLE.md`. That file is self-contained, so you do not need any other writing skill. Code comments and commit messages use British English and plain language.

## Decisions and progress

- Record every decision that the design pack does not settle in `design/DECISIONS.md`, with the reason.
- Keep `design/PROGRESS.md` up to date after each step.
- Write the spike results to `design/ARCHITECTURE.md`.

## Do not

- Copy the mockup page's script into the package. It is a prototype that bypasses Expressive Code. Use it to understand the behaviour, then build on the Expressive Code plugin API.
- Add runtime dependencies that the spec does not name without an entry in `design/DECISIONS.md`.
- Load client JavaScript on pages that don't use the feature it belongs to.
- Build snippet import or an Ask AI button. Both were considered and dropped.
