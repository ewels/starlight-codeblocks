# The Markdown pipeline (Sätteri)

**Sätteri is the default and the recommendation.** It is Astro's native Rust Markdown/MDX pipeline, and as of Astro 7 it renders `.md` files out of the box — `@astrojs/markdown-remark` is no longer installed by default. For a docs site, which is the workload it was built for, there is no reason to opt out unless a specific unportable plugin is load-bearing.

Astro's own benchmarks put it at over a minute saved on both the Astro and Cloudflare docs builds. Docs sites are exactly where the advantage compounds: every plugin in a `unified()` chain walks the full AST, so more plugins means more passes over the same content, whereas Sätteri implements GFM tables, footnotes, smart punctuation and highlighting hooks natively.

## Contents

- [Config shape](#config-shape)
- [What it does not run](#what-it-does-not-run)
- [**Do you need to port?**](#do-you-need-to-port-almost-certainly-not) — decision tree; the answer is usually no
- [Starlight and Expressive Code under Sätteri](#starlight-and-expressive-code-under-satteri)
- [Plugin ordering gotchas](#plugin-ordering-gotchas)
- [Raw HTML and untrusted content](#raw-html-and-untrusted-content)
- [Upgrading](#upgrading)

## Config shape

On Astro 7 the default needs no configuration at all. Configure explicitly only to set features or plugins:

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';

export default defineConfig({
  markdown: {
    processor: satteri({
      features: { directive: true },
      mdastPlugins: [],
      hastPlugins: [],
    }),
  },
});
```

**`satteri()` accepts only three keys: `features`, `mdastPlugins`, `hastPlugins`.** Anything else passed to it — `shikiConfig`, `gfm`, `smartypants` — is silently dropped. Those belong one level up, on `markdown`, alongside `processor`. This is a common and invisible mistake.

`features: { directive: true }` enables directive syntax, which is what aside blocks (`:::note`) are built on. Relevant when configuring a non-Starlight Astro site or a custom collection; Starlight handles its own asides.

The deprecated top-level keys move onto the processor: `markdown.gfm` and `markdown.smartypants` become `satteri({ features: { gfm: false, smartPunctuation: false } })`. Astro logs a deprecation warning naming the offending keys. `markdown.remarkPlugins`, `rehypePlugins` and `remarkRehype` still work but now require `@astrojs/markdown-remark` to be installed, and are slated for removal in a future major.

**MDX:** switching the processor covers `.md` and `.mdx` together. `recmaPlugins` is not supported under Sätteri. To split — Sätteri for `.md`, unified for `.mdx` — override the MDX integration with `mdx({ processor: unified({ ... }) })`.

## What it does not run

**Sätteri does not run remark or rehype plugins.** A native Rust pipeline cannot execute JavaScript plugins, so this is architectural and permanent, not a gap awaiting a fix.

The failure mode is silent in the worst way: the config keys remain valid, the build succeeds, and the transforms never apply. Astro emits a processor-mismatch warning when `markdown.remarkPlugins`/`rehypePlugins`/`remarkRehype` are set while Sätteri is active, but the pages just render without whatever the plugin did. `remark-toc`, `rehype-slug`, `rehype-autolink-headings`, custom slug logic and maths rendering all stop.

**When something that used to work stops working after an Astro 7 upgrade, this is the first suspect.** Check the plugin's issue tracker before debugging your own config — a great many integrations still only register transforms when the processor is `unified()`, and fall through to the deprecated arrays otherwise. Detect which is active with `isSatteriProcessor()` from `@astrojs/markdown-satteri` or `isUnifiedProcessor()` from `@astrojs/markdown-remark`.

## Do you need to port? (almost certainly not)

**You almost certainly should not port anything.** Astro's own docs list "you are not ready to port your existing Unified plugins to Sätteri" as a supported reason to use `unified()`. It is a first-class processor, not a deprecated fallback, and opting back in is one install plus one config line. Work through this in order and stop at the first hit:

### 1. Does the project have any remark/rehype plugins at all?

Check `astro.config.mjs` for `remarkPlugins`, `rehypePlugins`, `remarkRehype`, or a `processor:` line. Most Starlight sites have none. **No plugins → nothing to do.** Sätteri is already the default on Astro 7; delete the deprecated top-level `markdown.gfm`/`smartypants` keys if present and move on.

### 2. Is the plugin already redundant on a Starlight site?

Delete these rather than porting them — Starlight or Expressive Code already does the job, and running both is duplicated work at best and conflicting output at worst:

| Plugin | Why it's redundant |
| --- | --- |
| `remark-gfm` | GFM is on by default in both processors — tables, strikethrough, task lists, footnotes |
| `remark-smartypants` | Smart punctuation is on by default (`features.smartPunctuation`) |
| `rehype-slug`, `rehype-autolink-headings` | Starlight renders clickable heading anchors natively (`markdown.headingLinks`, default `true`) |
| `remark-toc` | Starlight builds the on-page table of contents from headings; configure via the `tableOfContents` option |
| `rehype-highlight`, `rehype-prism`, Shiki plugins | Expressive Code owns all code block rendering |
| `remark-directive` plus a custom aside/callout transform | Starlight's asides are native; `:::note` works in plain `.md` |
| `rehype-github-alerts` | Use `starlight-github-alerts`, or just write Starlight asides |

That table covers the large majority of what turns up in a real docs config.

### 3. Anything genuinely left over?

**Keep `unified()`. Don't port.** Install the package Astro 7 no longer ships by default and name the processor:

```sh
npm install @astrojs/markdown-remark
```

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';

export default defineConfig({
  markdown: {
    processor: unified({
      remarkPlugins: [/* your existing plugins, unchanged */],
      rehypePlugins: [],
    }),
  },
});
```

Note the plugins move *onto the processor* — the top-level `markdown.remarkPlugins` keys are deprecated and slated for removal, so this migration is worth doing regardless of which processor you pick. Starlight and Expressive Code both work fine under `unified()`; that was the only pipeline until recently.

**Expect step 2 to empty the config and this step never to fire.** On a normal Starlight docs site — prose, code blocks, components — everything in that table deletes and nothing survives to here. Don't go looking for a reason to keep unified.

The genuine exceptions are narrow: maths (`remark-math` + `rehype-katex`, which neither Sätteri nor Starlight covers) and `recmaPlugins`, which Sätteri does not support for MDX at all. If neither is in play, the answer is Sätteri, unconditionally, with no processor config at all.

### 4. Only then consider porting

Realistically: don't. Porting needs the build to be measurably slow *and* Markdown-bound, a maintained Sätteri equivalent to exist, and appetite for debugging pipeline-ordering issues. On a docs site under a few hundred pages none of that holds, and a step-2 deletion gets you to pure Sätteri anyway.

If you do go looking, community ports exist (`satteri-slug`, `satteri-autolink-headings`, `satteri-katex`, `satteri-callouts`, `satteri-imgattr`) but they are reimplementations, not drop-ins — options don't carry over. There is no unified compatibility shim, and Sätteri's one-pass model means there probably won't be one.

### Splitting processors

If MDX is the only thing holding you back, run Sätteri for bulk `.md` and unified for `.mdx` via `mdx({ processor: unified({ ... }) })`. This adds a second pipeline to reason about, so treat it as a last resort rather than a clever default.

## Starlight and Expressive Code under Sätteri

Both are handled — this is why a Starlight site can adopt Sätteri without ceremony:

- **Starlight 0.41** supports Astro 7 with Sätteri by default. Asides, clickable heading anchor links and RTL code block support all work. Starlight uses a dual-processor pattern internally (`@astrojs/starlight/integrations/markdown-plugins.ts`) and detects the active processor rather than assuming.
- **Expressive Code** processes code blocks through an equivalent Sätteri HAST plugin instead of the rehype plugin when `markdown.processor` is `satteri()`. No configuration change required. Starlight 0.41 bundles Expressive Code 0.43.1.
- `rehype-expressive-code` is the current package name; `remark-expressive-code` is deprecated. Projects using the `astro-expressive-code` integration get the right one automatically.

Starlight's Markdown processing applies only to content loaded via `docsLoader()`. Content from custom loaders or other collections does not get it by default — see the multi-repo section in `references/conventions.md`.

## Plugin ordering gotchas

If writing or configuring Sätteri plugins, the pipeline order is: syntax highlighter → your `hastPlugins` → image marker → heading ids. Consequences:

- **Maths goes in `mdastPlugins`, not `hastPlugins`.** The highlighter runs first, and by HAST stage display maths is still a `<pre><code>` — so it gets highlighted as a plaintext code block and never reaches a HAST maths plugin.
- **Heading ids are assigned after your plugins.** An autolink-headings plugin therefore needs a slug plugin ahead of it, or every anchor is skipped because the headings have no id yet.
- **A returned plugin definition is reused across every compile.** Pass a factory (`() => defineMdastPlugin(...)`) when per-compile state matters.

## Raw HTML and untrusted content

Sätteri passes raw HTML through unparsed. **For a docs site written by maintainers, ignore this.** It matters only if content is user-supplied or pulled from an untrusted source, where it is an XSS vector by default and needs sanitising as the last step in `hastPlugins`. Don't reach for a community sanitiser package on a maintainer-authored site — the risk it addresses doesn't exist there, and the dependency does.

## Upgrading

`npx @astrojs/upgrade` handles the version bump. Then, in order:

1. Build on a branch and read the warnings — processor-mismatch warnings name the config keys that have stopped taking effect.
2. Check every community Starlight plugin and Astro integration for Astro 7 support.
3. Fix markup the Rust compiler now rejects. It is stricter than the old Go compiler: unclosed tags error rather than being auto-corrected, so markup that was only ever valid by auto-correction breaks on a fresh build.
4. Check whitespace-sensitive output. Astro 7 defaults `compressHTML` to `'jsx'`, stripping whitespace by JSX rules. Set `compressHTML: true` for the old HTML-aware behaviour or `false` to preserve everything.
5. Diff rendered pages, and diff any generated `llms-full.txt`, before and after.
