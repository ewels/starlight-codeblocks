# Build plan

Work through the steps in order. Each step ends with a commit on `main`. Each phase ends with a push. Never tag, release or publish.

The features in phases 4 to 7 do not depend on each other once phase 3 is done. They could run on separate branches (`feat/<feature>`) in parallel sessions. In a single session, do them in order on `main`.

## Definition of done for a feature

A feature step is done when all of these are true:

- The feature matches `SPEC.md`, including its options, its accessibility notes and its behaviour without JavaScript.
- Unit tests render real code blocks through Expressive Code and check the HTML. They cover every attribute and directive of the feature, the copied text, and the unchanged output when the feature is not used.
- Interactive features have Playwright tests that use the keyboard as well as the pointer, and that check reduced motion.
- A Playwright screenshot of the docs example, in the dark theme, matches the mockup in layout, spacing and behaviour. Check the light theme too.
- The feature has a docs page that follows `DOCS-SITE.md` and passes `pnpm lint:docs` and the checklist in `WRITING-STYLE.md`.
- `design/PROGRESS.md` shows the step as done.

## Phase 0: set up

0.1 If `main` has no commits, commit the design pack, `AGENTS.md`, `CLAUDE.md` and `KICKOFF.md` to `main`, and push.

## Phase 1: answer the architecture questions

1.1 Work through `ARCHITECTURE-QUESTIONS.md` with small throwaway experiments in a temporary folder. Do not commit the experiments.

1.2 Write the answers to `design/ARCHITECTURE.md`. For each question, give the answer, the evidence, and the design choice that follows. Update the plan in `PROGRESS.md` if an answer changes a later step.

## Phase 2: scaffold

2.1 Create the pnpm workspace: `packages/<name>` (TypeScript, ESM, built with tsup or tsdown, with type definitions and an `exports` map) and `docs/` (Starlight, using the package through `workspace:*`).

2.2 Set up Vitest with a render helper that runs a Markdown code block through Expressive Code with the plugin, and returns the HTML and the copied text.

2.3 Set up Playwright against a production build of the docs site, with projects for desktop and a 360 px phone, and for light, dark and reduced motion.

2.4 Write `scripts/lint-docs.mjs` from the rules in `WRITING-STYLE.md`, and add `pnpm lint:docs`.

2.5 Add a CI workflow that runs lint, unit tests, both builds and the Playwright tests on pull requests and on pushes to `main`.

2.6 Build the docs site's page skeleton from `DOCS-SITE.md`, including the `Example` component, with placeholder pages. Placeholder pages say "Not yet written" and nothing else.

## Phase 3: foundations

3.1 Options: the `codeblocks(options)` Starlight plugin, the `/expressive-code` subpath with the preset, option validation, and the registration route from the spike.

3.2 The range parser and the comment notation parser, with the comment syntax map, escaping and build warnings. Test them on their own, then through Expressive Code.

3.3 The client module loader, so that each page loads only the modules it needs, and the positioning helper for popovers and hover cards.

3.4 Style settings and theme handling: the shared tokens, light and dark values, and the class prefix.

3.5 Docs: the getting started page, the configuration reference page (with the options known so far) and the comment notation reference page.

## Phase 4: line features

4.1 Focus.

4.2 Line states, including custom states.

4.3 Word-level diff.

4.4 Visible whitespace.

4.5 Colourised brackets.

4.6 Hidden lines.

4.7 Expandable blocks.

## Phase 5: annotations

5.1 Inline callouts.

5.2 Annotations.

5.3 Footnotes, including the sticky option.

5.4 Side-by-side annotations.

5.5 Docs: the guide that helps authors choose between callouts, annotations, footnotes and side-by-side annotations.

## Phase 6: title bar and copy features

6.1 Smart shell copy.

6.2 Open in playground, with the two built-in playgrounds and the custom playground interface.

6.3 Token links.

6.4 Fill-in placeholders, including playground links.

## Phase 7: page features

7.1 Line permalinks.

7.2 Code mentions.

7.3 Code switcher.

## Phase 8: components

8.1 Token transitions.

8.2 Scrollycoding.

## Phase 9: API auto-linking

9.1 The adapter interface, the hover card and the build-time cache for fetched inventories.

9.2 The Python adapter, with the standard library inventory and starlight-pydocs support.

9.3 The Nextflow adapter, with the bundled channel and operator map and the module URL pattern.

9.4 Docs: the feature page and a guide to writing an adapter.

## Phase 10: inline code highlighting

10.1 Inline code highlighting, through the hook the spike found.

## Phase 11: run in the browser

11.1 The runtime interface, the Run button and the output panel.

11.2 The Pyodide runtime, in a web worker.

11.3 Docs: the feature page and a guide to adding a runtime.

## Phase 12: finish

12.1 Complete every docs page. Remove all placeholder text. Complete the reference pages for options, attributes, directives and style settings.

12.2 Write the migration guide for VitePress users.

12.3 Write the package README: what it is, the one-line install and set-up, one example, and a link to the docs. Follow `WRITING-STYLE.md`.

12.4 Fill in `package.json`: description, keywords (include `withastro`, `starlight-plugin` and `expressive-code`), repository, licence (MIT) and `files`. Add a `CHANGELOG.md` with one "Unreleased" section. Do not change the version from `0.0.0`.

12.5 Final review:
- Run every check.
- Read every docs page against the `WRITING-STYLE.md` checklist.
- Compare every feature with the mockups side by side.
- Check the whole site with a keyboard and with a screen reader in a browser, if one is available.

12.6 Return to any blocked steps. Then write the summary in `PROGRESS.md`, push, and open the draft pull request, as `KICKOFF.md` describes.
