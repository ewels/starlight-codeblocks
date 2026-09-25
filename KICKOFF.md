# Kick-off prompt

## Objective

Build the first release of this repository's Starlight code block plugin: all 24 features in `design/SPEC.md`, the docs site in `docs/`, the tests and the CI. Work through `design/PLAN.md` from the first step to the last, without stopping to ask questions.

## Read first, in this order

1. `AGENTS.md`: rules for this repository. They apply to the whole session.
2. `design/README.md`: what each design file is for, and which one wins when they disagree.
3. `design/PLAN.md`: the steps, in order, with a definition of done.
4. `design/SPEC.md`: syntax and behaviour for every feature.
5. `design/ARCHITECTURE-QUESTIONS.md`: the questions to answer before any feature code.
6. `design/WRITING-STYLE.md` and `design/DOCS-SITE.md`: how the docs must read and how the site is organised.
7. `design/mockups.html`: open it in Playwright and try each feature before you build it.

## How to work

- Follow the steps in `design/PLAN.md` in order. Finish each step, including its tests and docs page, before you start the next one.
- Commit after each step and push `main` after each phase, as `AGENTS.md` describes. Never tag, release or publish.
- When the design pack does not settle a question, make the decision that best matches the mockups and the spec. Record it in `design/DECISIONS.md` and continue. Do not stop to ask.
- If a step is blocked after two different approaches, record what you tried in `design/DECISIONS.md`, mark the step as blocked in `design/PROGRESS.md`, and move to the next step. Return to blocked steps at the end of the plan.
- Keep `design/PROGRESS.md` current, so that a person who reads it in the morning knows the state of every step.

## Checks before each push

- `pnpm lint`, `pnpm test`, `pnpm docs:build` and `pnpm test:e2e` pass.
- `pnpm lint:docs` passes, and you have read every changed docs page against the checklist in `design/WRITING-STYLE.md`.
- For each feature built in the phase, a Playwright screenshot of the docs example matches the mockup in layout, spacing and behaviour. Theme colours can differ, because the real plugin uses the site's Expressive Code themes.

## Hard limits

- Never create git tags or GitHub releases. Never run `npm publish` or `pnpm publish`.
- Never delete files that you did not create, except when a plan step says to.
- Never add remark or rehype plugins.

## When the plan is complete

1. Update `design/PROGRESS.md` with a summary: what is done, what is blocked and why, and what a person needs to check first.
2. Push `main`.
3. If the GitHub CLI is authenticated, open a draft pull request from `main` to `main`. Use the summary as the description.
