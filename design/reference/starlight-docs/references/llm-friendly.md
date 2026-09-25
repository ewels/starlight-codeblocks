# Making a Starlight site LLM-friendly

Two separate problems, often conflated:

1. **Retrieval** — can an agent get clean Markdown instead of parsing rendered HTML?
2. **Discovery** — does the agent know the clean version exists?

Most sites solve (1) and skip (2), which is why llms.txt files often see little traffic. Astro's docs removed their own llms.txt in May 2026 citing low uptake, having never added an on-page pointer to it — and `docs.astro.build` serves no `.md` variants and returns HTML under `Accept: text/markdown`. Do both halves or the work is largely wasted.

There are three retrieval channels, in ascending order of effort: per-page Markdown, llms.txt, and MCP. They aren't alternatives — an agent handed a URL wants the first, an agent starting cold wants the second, and an agent that needs to search rather than ingest wants the third.

## Contents

- [Per-page Markdown](#per-page-markdown) — `.md` URL variants
- [Content negotiation](#content-negotiation) — serving Markdown by user agent
- [Page action buttons](#page-action-buttons-copy-as-markdown-open-in-assistant) — human-facing entry point
- [llms.txt](#llmstxt) — site-level index
- [MCP](#mcp) — search rather than ingest
- [Multi-product sites](#multi-product-sites) — scoping so retrieval hits the right docs
- [Discovery](#discovery) — making any of it findable
- [Checking plugin compatibility](#checking-plugin-compatibility) — how to tell a live plugin from a dead one
- [Writing for both audiences](#writing-for-both-audiences)
- [Recommended baseline](#recommended-baseline)
- [Verification](#verification)

---

## Per-page Markdown

Serve every page's source at a predictable URL so an agent handed a docs link can fetch the source instead of scraping the rendered page.

`starlight-dot-md` ([morinokami](https://github.com/morinokami/starlight-dot-md)) exposes `.md`, `.mdx` and `.mdoc` pages as raw Markdown by appending `.md` to the URL — `/guides/example` → `/guides/example.md`:

```js
// astro.config.mjs
import starlightDotMd from 'starlight-dot-md';

starlight({
  plugins: [starlightDotMd()],
})
```

Alternatives: `starlight-md-txt` serves the same thing at `.md.txt` URLs (better if a host insists on serving `.md` as a download), and `starlight-page-actions` copies the raw files itself as part of its button feature.

**Use `starlight-page-actions` for this and do not install a separate Markdown-route plugin.** It serves the raw `.md` files itself as part of its copy/view buttons, so adding `starlight-dot-md` or `starlight-md-txt` alongside it duplicates route registration and breaks the build. One plugin, both jobs.

`starlight-dot-md` and `starlight-md-txt` are the standalone options if you specifically don't want buttons on the page. Both predate Astro 7 and declare no support for it, so prefer `starlight-page-actions` unless a buttonless site is a hard requirement.

## Content negotiation

An alternative to `.md` URLs: detect agent user-agents (`Claude-User`, `ChatGPT-User`, `cursor-agent`) or `Accept: text/markdown` at the edge and serve Markdown from the canonical URL. This works without the agent knowing any URL convention, which is its whole appeal.

Two caveats before reaching for it:

- **Cache correctness.** Varying response body by request header requires a correct `Vary` header, or a CDN will serve Markdown to browsers and HTML to agents at random. This is the usual way the approach breaks.
- **User-agent lists rot.** New agents appear constantly and many don't identify themselves distinctly.

Treat it as a supplement to explicit `.md` URLs rather than a replacement — the URLs are cacheable, testable, and linkable. Best combined with an "LLMs sitemap" listing the Markdown URLs so agents can enumerate them.

## Page action buttons (copy as Markdown, open in assistant)

A dropdown or button next to the page title letting a reader copy the page as Markdown or send it to an assistant. This is the highest-value human-facing piece, because the person copies the Markdown and pastes it wherever they like — no URL convention or vendor support required.

**Do not use `starlight-contextual-menu`.** It is widely linked and widely recommended, but as of August 2026 the latest release is 0.1.5 from **October 2025**, with `peerDependencies` pinned to `astro: ^5.0.0`. It predates Astro 6 and 7. Worse, it takes a peer dependency on `starlight-markdown` ^0.1.5, last published August 2025 and also Astro 5 only — a two-deep stale chain. The `@ekline/starlight-contextual-menu` fork is newer (0.3.0, May 2026) but declares `astro: ^5.0.0 || ^6.0.0`, so it still excludes Astro 7.

Working alternatives, all published after Astro 7 shipped:

| Plugin | Latest | Notes |
| --- | --- | --- |
| `starlight-page-actions` | 0.7.0 (Jul 2026) | Best default. Copy Markdown, Open dropdown (ChatGPT, Claude, Cursor, Perplexity, Copilot), View in Markdown, Share menu. **Custom actions** — the escape hatch for an in-house assistant, no component override needed. Custom prompt template, i18n prompts, per-page disable, and can strip or replace Starlight components in the generated Markdown. |
| `starlight-llm-actions` | 0.9.0 (Jul 2026) | Similar surface plus PDF export and Gemini/T3 Chat. |
| `starlight-page-context-action` | 0.4.3 (Jul 2026) | Puts actions in the right sidebar above the table of contents rather than by the title. |

**Use `starlight-page-actions`.** The other two are listed as fallbacks if it breaks, not as a menu to deliberate over — `starlight-llm-actions` if you want PDF export, `starlight-page-context-action` if you want the buttons in the table of contents (though page-actions does that too via `position`).

All three declare open peer ranges (`starlight >=0.36.0`, `astro >=5.x`) rather than explicit Astro 7 pins, and page-actions' own docs site still runs Starlight 0.38.3, so the author isn't dogfooding on 0.41 yet. That means: install it, run `astro build`, and click the buttons once. If the build is green and the buttons work, you're done — this is a five-minute check, not a reason to hesitate.

### Configuring `starlight-page-actions`

```js
// astro.config.mjs
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import starlightPageActions from 'starlight-page-actions';

export default defineConfig({
  integrations: [
    starlight({
      title: 'My Docs',
      plugins: [
        starlightPageActions({
          baseUrl: 'https://mydocs.example.com/',
          prompt: 'Read {url} and explain its main points briefly.',
          actions: {
            chatgpt: true,
            claude: true,
            cursor: false,
            custom: {
              ourAssistant: { label: 'Open in Our Assistant', href: 'https://assistant.example.com/?q=' },
            },
          },
          position: 'page-title',
          share: false,
        }),
      ],
    }),
  ],
});
```

Six options, all optional:

- **`baseUrl`** — **required for `llms.txt` to be generated at all.** Without it the file is silently not created, which is an easy thing to miss. It's also applied to internal links in the generated Markdown; omit it and internal links stay relative, which breaks them once a page is fetched out of context.
- **`prompt`** — template for the assistant actions. `{url}` is substituted; if omitted the URL is appended. Worth customising, since the default ("Read {url}. I want to ask questions about it.") wastes the opportunity to tell the model what the docs are.
- **`actions`** — booleans for the built-ins (ChatGPT, Claude, T3 Chat, v0, Cursor, Perplexity, GitHub Copilot, Markdown) plus `custom`, a record of `{ label, href }`. The custom entry is how an in-house assistant gets a button, provided it accepts a prefilled prompt in a query string.
- **`share`** — default `false`. Leave it off on a technical docs site; a row of social buttons is noise, and it's a separate concern from machine readability.
- **`locales`** — per-locale overrides for `prompt` and custom action labels/hrefs, keyed to Starlight's locale keys. Define the custom action at top level first, then override only the changed fields.
- **`position`** — `'page-title'` (default) or `'table-of-contents'`.

The plugin also documents an Agent Skills page of its own, which is worth a look given it overlaps with this skill's territory.

**`starlight-page-actions` also generates `llms.txt` and serves the raw `.md` files** (via `vite-plugin-static-copy`). That makes it collide with `starlight-llms-txt` over `llms.txt`, and with any per-page Markdown plugin over the `.md` routes. The split to use: **`starlight-llms-txt` owns `llms.txt`; `starlight-page-actions` owns the `.md` routes.** Enforce it by leaving `baseUrl` unset on page-actions, which stops it writing `llms.txt` at all.

Note the two `llms.txt` implementations are not equivalent. `starlight-page-actions` generates an index of documentation URLs from the sidebar config; `starlight-llms-txt` generates `llms.txt` plus `llms-full.txt` and `llms-small.txt` containing the actual content, with `customSets`, `promote`/`demote` and `minify`. If content sets matter — and on a multi-product site they do — let `starlight-llms-txt` own `llms.txt` and leave `baseUrl` unset on page-actions so it doesn't write a competing file.

### Choosing actions

Copy and view are the ones that pay off regardless, since they serve anyone pasting docs into any tool, and copy is the honest default for privacy because it doesn't hand a URL to a third party. Each vendor-specific action adds a button and helps only that product's users, so a short list beats an exhaustive one.

**Assistant actions depend on the vendor accepting a URL with a prefilled prompt.** An in-house or self-hosted assistant that doesn't accept a URL of that shape cannot be wired up at all, regardless of plugin. Where it does, `starlight-page-actions` custom actions handle it without a Starlight component override. If neither applies, ship copy and let people paste.

## llms.txt

`starlight-llms-txt` ([delucis](https://github.com/delucis/starlight-llms-txt), also listed on Starlight's official plugins page) generates three files:

- `llms.txt` — index, per [llmstxt.org](https://llmstxt.org/)
- `llms-full.txt` — complete documentation
- `llms-small.txt` — filtered for smaller context windows

```js
// astro.config.mjs
import starlightLlmsTxt from 'starlight-llms-txt';

export default defineConfig({
  site: 'https://example.com/',   // required — URLs in the output need it
  integrations: [
    starlight({
      plugins: [
        starlightLlmsTxt({
          projectName: 'Very Cool Tool',
          description: 'One-paragraph summary of what this is.',
        }),
      ],
    }),
  ],
});
```

### Options worth setting

`projectName` (defaults to Starlight's `title`) and `description` (defaults to Starlight's `description`) — set both explicitly. The site title is often a bare product name that tells a model nothing; per llmstxt.org the description should be a short summary carrying the key information needed to interpret everything else. `details` adds further Markdown after it.

`customSets` is the most underused option. For a large site, one giant `llms-full.txt` forces a model to ingest everything or nothing. Custom sets give it a choice:

```js
customSets: [
  { label: 'Reference', description: 'full reference documentation', paths: ['reference/**'] },
  { label: 'Tutorial',  description: 'step-by-step tutorial',        paths: ['tutorial/**'] },
],
```

`promote` (default `['index*']`) and `demote` sort pages within the full and small outputs — put orientation pages first and changelogs last. Patterns are `micromatch` globs over page slugs; a page matching both is demoted.

`exclude` filters pages out of `llms-small.txt` only — use it for tutorials and long-form content that a small-context model doesn't need.

`optionalLinks` adds links a model may skip. Reserve it for material not already in the docs content.

`rawContent: true` skips HTML processing. **Required if content includes React, Vue, or Svelte components**, and faster on large sites.

`minify` controls what gets stripped from `llms-small.txt`. Defaults exclude `note` asides, `tip` asides, and `<details>` elements, keep `caution` and `danger`, and collapse whitespace. Two consequences worth knowing: information parked in a `:::note` disappears from the small output, which is another argument for keeping essential content in body text; and `minify.whitespace` preserves newlines inside fenced code blocks unless `collapseCodeBlocks` is also set, so code samples stay readable by default.

`customSelectors` removes elements by CSS selector before Markdown conversion. Object form targets specific outputs — `{ all: [...] }`, `{ full: [...] }`, `{ small: [...] }`. Needed for interactive widgets, sponsor banners, and Twoslash popovers, which otherwise convert into noise:

```js
customSelectors: {
  all: ['.twoslash-popup-container', '.twoslash-error-box', 'interactive-demo'],
},
```

`pageSeparator` (default `"\n\n"`) — a visible separator such as `'\n----------\n'` makes page boundaries clearer in the concatenated output.

## MCP

An MCP server lets an agent *search* the docs rather than ingest all of them — the right shape when the site is too large for any llms.txt to fit a context window. Options as of writing:

- **`starlight-mcp`** — `search_docs`, `get_doc`, `list_docs` over stateless streamable HTTP. Astro integration plus a plain fetch handler and Cloudflare static-assets glue.
- **`@stellayazilim/mcp-starlight`** — build-time catalogue plus a stdio server over `npx`, so no hosting at all. Works on GitHub Pages. Locale- and version-aware.
- **`starlight-agentready`** — submits docs to the AgentReady service after each build, queryable via their MCP. Third-party dependency.

**Consider extending an existing MCP server before adding a docs-specific one.** If the organisation already ships an MCP server for its product, adding docs search to that server usually beats standing up a second one: users connect once, the agent gets docs and product context together, and there's one thing to maintain. A separate docs MCP means users configuring two servers and an agent that can't join up "how do I do X" with "what is my current state". The docs site's job in that case is just to advertise the existing server — a custom page action or a link on the docs index.

MCP is the highest-effort channel and the least likely to be reached by a general-purpose crawler. Do llms.txt and `.md` routes first.

## Multi-product sites

A single Starlight site hosting several products' docs breaks retrieval in a specific way: an unscoped index answers questions about product A using product B's pages, confidently. This shows up in vector search and in llms.txt output alike, and it's much more likely when the products share vocabulary (config files, CLI flags, run commands).

Mitigations:

- **`customSets` per product**, so an agent can ingest one product's docs rather than the union. This is the main lever and the reason `customSets` matters more on multi-product sites than anywhere else.
- **`projectName` and `description`** stating plainly what each set covers and what it does not.
- **Check coverage before blaming relevance.** A model answering about the wrong product often isn't a ranking failure — the right pages simply aren't in the index. Confirm the sub-pages are present in `llms-full.txt` before tuning anything.
- **Distinct page titles.** Three products with a page called "Configuration" retrieve poorly. "Configure the Nextflow CLI" is self-locating.

## Discovery

Generating the files is the easy half. Make them findable:

- **Link them from the docs.** A line in the site footer or on the docs index pointing at `/llms.txt` is the single highest-value step, and the one Astro's docs omitted.
- **`<link rel="alternate" type="text/markdown">`** in the page head pointing at the `.md` variant, so a crawler on any page can find the source without guessing the URL scheme. Add via Starlight's `head` config or a route middleware.
- **`robots.txt`** — reference `/llms.txt` in a comment. Cheap, occasionally read.
- **Page action buttons are themselves discovery** — a visible button beats any convention, because the human copies the Markdown and pastes it wherever they like.

If measuring uptake, filter server logs by agent user-agents (`Claude-User`, `ChatGPT-User`, `cursor-agent` and similar) rather than counting raw page views on `/llms.txt`. Page views on a machine-readable file are close to meaningless as a signal.

## Writing for both audiences

Prose choices that help agents also tend to help skimming humans:

- **Front-load the answer.** State what a thing does in the first sentence, before context or motivation. Both a model with a context budget and a reader scanning benefit.
- **Keep essential information in body text.** It survives `minify`, and readers don't skip it.
- **Self-describing headings.** "Configure the sidebar" retrieves better than "Configuration" and is a more useful anchor link.
- **Write the `description` frontmatter on every page.** It feeds meta tags, Pagefind, and llms.txt output.
- **Avoid meaning that lives only in rendering.** A tab label, a card grid's visual arrangement, or a diagram with no alt text all flatten in Markdown conversion. If a distinction matters, say it in words too.
- **Expressive Code markers survive conversion poorly.** Highlights and coloured line markers become plain code in Markdown, so a block whose entire point is "look at the green lines" reads as undifferentiated code to an agent. Where the marked lines carry the message, use labelled markers — the label text survives as words.
- **Absolute or root-relative links.** Relative links break once a page is fetched out of context.

## Recommended baseline

For a docs site starting from nothing, in priority order:

1. `starlight-llms-txt` with `projectName`, `description`, and `customSets` — the latter is not optional on a multi-product site. Let this own `llms.txt`.
2. `starlight-page-actions` for the copy/open buttons, letting it own the raw `.md` routes. Leave `baseUrl` unset so it doesn't write a competing `llms.txt`. Not `starlight-contextual-menu`, which is stale.
3. A dedicated per-page Markdown plugin (`starlight-dot-md`) only if step 2's own route handling doesn't fit.
4. A visible link to `/llms.txt` and `rel="alternate"` head tags.
5. `description` frontmatter on every page.

Steps 1–3 are an afternoon. Step 4 is fifteen minutes and is what makes 1–3 matter. Step 5 is ongoing and is the one that decays.

Defer MCP and user-agent content negotiation until the above is in place and there's evidence of demand — both cost real maintenance, and neither helps a crawler that only knows how to fetch a URL.

## Verification

```sh
npx astro build
ls dist/llms*.txt
head -40 dist/llms.txt
```

Then check by hand:
- Does `llms-full.txt` contain converted component content, or empty gaps where components were? Gaps mean `rawContent: true` is needed.
- Do interactive widgets appear as noise? Add `customSelectors`.
- Fetch a `.md` URL from the built site and confirm it returns Markdown with the right content type, not HTML and not a download.
- Confirm only one plugin is registering Markdown routes.

## Checking plugin compatibility

Every plugin here is community-maintained, and Astro shipped two majors in four months. **A README that reads as current tells you nothing** — `starlight-contextual-menu`'s README documents its options perfectly well and the package hasn't shipped since October 2025.

The reliable test is `peerDependencies`, not the README, not the star count, not the docs site:

```sh
npm view starlight-page-actions version time.modified peerDependencies
```

Read it like this:

- **`astro: ^7.0.0` or `>=7.x`, or `@astrojs/starlight: >=0.41.0`** — the author has explicitly targeted the current stack. Trust it.
- **A dependency on `@astrojs/markdown-satteri`** — the author has actively handled the Sätteri migration. Strongest possible signal.
- **`astro: ^5.0.0` or `^5 || ^6`** — excludes Astro 7. Will not install cleanly, or will install and misbehave. Avoid.
- **An open range like `astro: >=5.0.0`** — tells you nothing. It installs on Astro 7 because the range never closed, not because anyone tested it. Check the publish date against 22 June 2026 and then build and click.

**Run `./scripts/refresh.sh` rather than reading the table below** — it computes the same verdicts live. The table is here so the reasoning survives when the network doesn't, and as the record of which plugins this skill's recommendations rest on.

Snapshot, August 2026 (Astro 7.2.2, Starlight 0.41.7):

| Plugin | Status |
| --- | --- |
| `starlight-llms-txt` 0.11.0 | ✅ Declares `starlight >=0.41.0`, `astro ^7.0.0` |
| `starlight-openapi` 0.26.1 | ✅ Declares `starlight >=0.41`, `astro >=7.0.2`, `@astrojs/markdown-satteri >=0.3.2` |
| `starlight-links-validator` 0.25.3 | ✅ Same, and now depends on `@astrojs/markdown-satteri` — the Sätteri incompatibility noted in Starlight's own repo in June has been fixed |
| `starlight-page-actions` 0.7.0 | ⚠️ Post-Astro 7 release, open range, verify |
| `starlight-llm-actions` 0.9.0 | ⚠️ Same |
| `starlight-dot-md` 0.2.1 | ⚠️ April 2026, pre-Astro 7 |
| `starlight-md-txt` 0.1.0 | ⚠️ June 2026, pre-Astro 7 |
| `starlight-mcp` 0.2.0 | ⚠️ `astro >=4.14.0`, meaninglessly open |
| `starlight-agentready` 1.0.0 | ⚠️ `starlight >=0.1.0`, meaninglessly open |
| `starlight-contextual-menu` 0.1.5 | ❌ Oct 2025, `astro ^5.0.0` only |
| `@ekline/starlight-contextual-menu` 0.3.0 | ❌ Excludes Astro 7 |
| `@stellayazilim/mcp-starlight` 0.2.1 | ❌ `astro ^5.0.0` only |
| `starlight-llm-button` 0.0.8 | ❌ May 2025 |

Being listed on `https://starlight.astro.build/resources/plugins/` is not a compatibility guarantee — `starlight-contextual-menu` is listed there and dead. Treat that page as a discovery source only, and run the script on anything it surfaces.

Whatever you install, diff the generated output (`llms-full.txt`, a `.md` route, the rendered buttons) before and after any Astro or Starlight upgrade. Under Sätteri an un-updated plugin can fail silently, producing an empty or malformed file rather than an error. See `references/markdown-pipeline.md`.
