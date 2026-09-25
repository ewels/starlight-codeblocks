# Design pack

This folder defines the first release of the plugin. The files are for the agent that builds it and for the people who review the work.

| File | Purpose |
|---|---|
| `SPEC.md` | Syntax, behaviour, options and acceptance criteria for every feature. |
| `mockups.html` | Working mockups of every feature. Open it in a browser. |
| `PLAN.md` | Build order, steps and the definition of done. |
| `ARCHITECTURE-QUESTIONS.md` | Questions to answer before any feature code, with fallbacks. |
| `WRITING-STYLE.md` | How the docs must read. Self-contained. |
| `DOCS-SITE.md` | Structure of the docs site and the template for each page. |
| `DECISIONS.md` | Log of decisions made during the build. The agent writes to it. |
| `PROGRESS.md` | State of each plan step. The agent writes to it. |
| `ARCHITECTURE.md` | Spike results. The agent creates it in phase 1. |
| `reference/starlight-docs/` | Copy of the `starlight-docs` skill: Expressive Code syntax, Sätteri, Starlight components. |

## Which file wins

- For syntax and behaviour, `SPEC.md` wins over the mockups.
- For look and feel (layout, spacing, sizes, motion), the mockups win unless `SPEC.md` gives a value.
- The mockups use a small hand-written tokeniser, so their syntax colours are approximate. The plugin uses the site's Expressive Code themes.
- The mockups animate token transitions line by line. The plugin animates individual tokens.
- The mockup page's scrollycoding demo scrolls inside a frame. The plugin uses normal page scrolling.
- The mockup colours are for the dark theme. The plugin needs light-theme values too, with the same contrast.

If you find a conflict that these rules do not settle, choose the option that is closest to the mockups, and record it in `DECISIONS.md`.
