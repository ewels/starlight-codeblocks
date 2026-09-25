# Expressive Code reference

Everything after the language identifier on an opening fence is the **meta string**. Attributes can appear in any order and combine freely.

## Contents

- [Line markers](#line-markers) — `{4}`, `{1,4,7-8}`, `ins=`, `del=`
- [Labelled markers](#labelled-markers) — `{"label":5-8}`
- [Diff syntax](#diff-syntax) — `diff`, `diff lang="js"`
- [Inline markers](#inline-markers) — `"string"`, `/regex/`
- [Frames and titles](#frames-and-titles) — `title=`, `frame=`
- [Word wrap](#word-wrap) — `wrap`, `preserveIndent`, `hangingIndent`
- [Collapsible sections](#collapsible-sections) — `collapse=`, `collapseStyle=` (plugin)
- [Line numbers](#line-numbers) — `showLineNumbers`, `startLineNumber=` (plugin)
- [The `<Code>` component](#the-code-component) — props, dynamic code, `?raw` imports
- [Config](#config) — `defaultProps`, `overridesByLang`, `ec.config.mjs`
- [Gotchas](#gotchas)

Provided by `@expressive-code/plugin-text-markers` and `@expressive-code/plugin-frames`, both installed and enabled by default in Starlight. Collapsible sections and line numbers are opt-in plugins.

---

## Line markers

Line numbers go in curly braces. **Counting starts at 1** and counts raw source lines in the fence, blank lines included.

| Form | Meaning |
| --- | --- |
| `{4}` | single line |
| `{4, 8, 12}` | three separate lines |
| `{4-8}` | inclusive range |
| `{1, 4, 7-8}` | combined |

Three marker types. `mark` is the default (neutral, blue-ish); `ins` renders green with a `+` gutter indicator; `del` renders red with `-`. Specify the type before the brace:

````md
```js title="line-markers.js" del={2} ins={3-4} {6}
function demo() {
  console.log('this line is marked as deleted')
  // This line and the next one are marked as inserted
  console.log('this is the second inserted line')

  return 'this line uses the neutral default marker type'
}
```
````

Use `ins`/`del` for actual changes and bare `{}` for "look here" — the semantic distinction matters to readers using colour cues.

## Labelled markers

Attach a text label to a marker, rendered as a coloured box on the first line of the range. Quote the label and follow it with a colon inside the brace:

- `ins={"A":6-10}` — short label, appears in the gutter beside the code
- `{"1":5}` — works with the default marker type too

Short labels (2–3 characters) can collide with the code; increase the `codePaddingInline` core style setting if they do.

**Long labels** need their own line. Insert a blank line in the code where the label should appear, then start the range on that blank line:

````md
```jsx {"1. Provide the value prop here:":5-6} del={"2. Remove the disabled and active states:":8-10}
// labeled-line-markers.jsx
<button
  role="button"
  {...props}

  value={value}
  className={buttonClassName}

  disabled={disabled}
  active={active}
>
```
````

This is the right tool for step-by-step walkthroughs of a single block — better than splitting the example across several fences.

## Diff syntax

Set the language to `diff` and prefix lines with `+` or `-` in column one:

````md
```diff
+this line will be marked as inserted
-this line will be marked as deleted
this is a regular line
```
````

Whitespace *after* the marker (not before) is allowed and is stripped from the output, so you can align unchanged lines for readability in the source.

**Keep syntax highlighting** by adding a second language via `lang`:

````md
```diff lang="js"
  function thisIsJavaScript() {
    // Highlighted as JavaScript, and still takes diff markers
-   console.log('Old code to be removed')
+   console.log('New and shiny code!')
  }
```
````

This is usually preferable to raw `diff`, which loses all highlighting.

**Actual diff files are left alone.** The plugin detects unified/context metadata (`***`, `+++`, `---`, `@@`) and default-mode location syntax (`0a1`, `1,2c1,2`, `1,2d1`) and skips all processing, so real patches paste in unmodified.

## Inline markers

Mark text *within* lines. Both forms match every occurrence in the block.

**Plaintext:** wrap in single or double quotes — `"given text"` or `'given text'`. Use the opposite quote type to avoid escaping nested quotes, or backslash-escape if you must mix both.

**Regex:** wrap in forward slashes — `/ye[sp]/`. Escape internal slashes as `\/`.

Capture groups narrow the highlight: `/ye(s|p)/` matches `yes` and `yep` but marks only the `s` or `p`. To match with a group but mark the whole thing, make it non-capturing: `/ye(?:s|p)/`. This trips people up constantly — if a regex marker highlights less than expected, check for capture groups.

Inline markers take types the same way as line markers:

````md
```js "return true;" ins="inserted" del="deleted"
function demo() {
  console.log('These are inserted and deleted marker types');
  return true;
}
```
````

## Frames and titles

Frame type is auto-detected from the language. Editor frame (VS Code-like tab) when a file name is known, terminal frame for shell languages, plain block otherwise.

**Title** — `title="my-test-file.js"` on the fence. For editor frames it becomes the file tab label; for terminal frames, the window title.

**File-name comments** are extracted automatically when no `title` is given, subject to all of:
- within the first 4 lines
- line starts with `//`, `<!--`, `/*` or `#` — but not `#!`
- optional prefix ending in a colon is allowed (`// File name: index.js`)
- the file name looks plausible for the block's language

The comment is then removed from the rendered code. Suppress extraction with an explicit `title`, `frame="none"`, or globally via `extractFileNameFromCode: false`.

**Terminal detection.** Languages treated as shell: `ansi`, `bash`, `bat`, `batch`, `cmd`, `console`, `powershell`, `ps`, `ps1`, `psd1`, `psm1`, `sh`, `shell`, `shellscript`, `zsh`. Within those, a `title`, a file-name comment, or a shebang (`#!`) makes it a *script file* — rendered as an editor frame if a name was given, plain otherwise. Everything else is a terminal session. Terminal frames need no title; the title bar always renders.

**Override** with `frame="code" | "terminal" | "none" | "auto"` (default `auto`):

````md
```sh frame="none"
echo "Look ma, no frame!"
```

```ps frame="code" title="PowerShell Profile.ps1"
function Watch-Tail { Get-Content -Tail 20 -Wait $args }
```
````

Relevant plugin options (set in config, not per-block): `showCopyToClipboardButton` (default `true`), `removeCommentsWhenCopyingTerminalFrames` (default `true` — strips `#` comment lines from copied terminal text, so instructions in comments don't end up pasted into a shell), `extractFileNameFromCode`.

## Word wrap

- `wrap` — enable wrapping for this block. Without it, long lines get a horizontal scrollbar.
- `preserveIndent` (default `true`) — wrapped continuations align to the line's indent level. Set `false` to reproduce terminal output, where continuations should start at column 1.
- `hangingIndent=N` — indent all wrapped continuations by N columns. Added on top of the original indent when `preserveIndent` is true.

`preserveIndent` and `hangingIndent` only take effect when `wrap` is on. All three are display-only — copying to the clipboard yields the original unwrapped lines.

Good default for CLI `--help` output and long shell commands: `wrap preserveIndent=false`.

## Collapsible sections

Requires `@expressive-code/plugin-collapsible-sections`. Collapsed lines are replaced by a clickable `X collapsed lines` element.

````md
```js collapse={1-5, 12-14, 21-24}
// boilerplate here is hidden by default
```
````

`collapseStyle=` picks the behaviour:

| Style | Behaviour |
| --- | --- |
| `github` (default) | Summary line is replaced on expand. Cannot re-collapse. |
| `collapsible-start` | Summary stays above the expanded lines; re-collapsible. |
| `collapsible-end` | Summary stays below; re-collapsible. |
| `collapsible-auto` | `collapsible-start`, unless the section ends at the bottom of the block, then `collapsible-end`. |

`collapsePreserveIndent` (default `true`) indents the summary line to match the contained code.

Set a project-wide default via `defaultProps: { collapseStyle: 'collapsible-auto' }` rather than repeating it on every block. `collapsible-auto` is a better default than `github` for reference docs, since readers often want to re-hide the boilerplate.

## Line numbers

Requires `@expressive-code/plugin-line-numbers`. **Once installed, line numbers are on for every block by default** — this surprises people. Turn them off globally and re-enable per language:

```js
// ec.config.mjs
defaultProps: {
  showLineNumbers: false,
  overridesByLang: {
    'js,ts,html': { showLineNumbers: true },
  },
},
```

Per block: `showLineNumbers`, `showLineNumbers=true`, `showLineNumbers=false`.

`startLineNumber=5` shifts the displayed numbering for excerpts from larger files. **Purely visual** — text markers are not aware of the shift, so `{6}` still means the sixth line of the fence, not displayed line 6. Count raw lines.

## The `<Code>` component

For code that comes from a variable, a file, or an API rather than being typed into the fence.

```mdx
---
title: My example page
---

import { Code } from '@astrojs/starlight/components'

<Code code="console.log('Hello world!')" lang="js" />
```

In a plain Astro project the import is `astro-expressive-code/components` instead. In `.astro` files the import goes inside the frontmatter fence.

**Import real code with Vite's `?raw`** so examples never drift from the source:

```mdx
import { Code } from '@astrojs/starlight/components';
import importedCode from '/src/env.d.ts?raw';

<Code code={importedCode} lang="ts" title="src/env.d.ts" />
```

This is the single most useful pattern in the whole API for a docs site that documents its own repo.

### Props

Core: `code` (required, non-empty string), `lang`, `meta` (raw meta string — an escape hatch for anything without a dedicated prop), `locale`, `title`, `frame`, `class`, `wrap`, `preserveIndent`, `hangingIndent`.

From text markers: `mark`, `ins`, `del`, `useDiffSyntax`.

`mark`/`ins`/`del` take a `MarkerDefinition` or an array of them, where a definition is `string | RegExp | number | { range: string; label?: string }`. So the label syntax from the fence becomes `ins={[{ range: '6-10', label: 'A' }]}`.

`useDiffSyntax` enables `+`/`-` prefix processing for non-diff languages.

From plugins: `collapse`, `collapsePreserveIndent`, `collapseStyle`, `showLineNumbers`, `startLineNumber`.

### `ec.config.mjs`

The component receives config as serialized JSON, so **any non-serializable option (custom plugins, functions) breaks it** with an error telling you to move config into `ec.config.mjs` at the project root. Since Starlight projects almost always end up with a plugin eventually, put Expressive Code config in `ec.config.mjs` from the start:

```js
// ec.config.mjs — Starlight
/** @type {import('@astrojs/starlight/expressive-code').StarlightExpressiveCodeOptions} */
export default {
  plugins: [pluginCollapsibleSections()],
  defaultProps: { collapseStyle: 'collapsible-auto' },
}
```

For plain Astro, `defineEcConfig` from `astro-expressive-code` gives typing.

## Config

Set inside Starlight's `expressiveCode` option, or in `ec.config.mjs`:

- `plugins: []` — opt-in plugins
- `defaultProps: {}` — default value for any per-block prop, with `overridesByLang: { 'js,ts': {...} }` for language-specific defaults
- `styleOverrides: {}` — nested per plugin: `textMarkers`, `frames`, `collapsibleSections`, `lineNumbers`

Marker colours are LCH-based: `markHue` (default `284`, blue), `insHue` (`136`, green), `delHue` (`33`, red), plus `backgroundOpacity`, `borderOpacity`, `defaultChroma`, `defaultLuminance`. Contrast is auto-corrected — Expressive Code tweaks text colours as needed to stay accessible while preserving syntax highlighting, so don't hand-tune foreground colours to compensate.

## Gotchas

- **Unknown meta is silently ignored.** No error, just a plain block. Verify rendered output rather than trusting the fence looks right.
- **Under Sätteri** (the default Markdown processor from Astro 7, and the recommended one), Expressive Code runs as a Sätteri HAST plugin rather than a rehype plugin. This is automatic and needs no config change. `rehype-expressive-code` is the current package; `remark-expressive-code` is deprecated. See `references/markdown-pipeline.md`.
- **Off-by-one line numbers build cleanly.** Count from 1, count blank lines, and check in the browser when ranges matter.
- **`startLineNumber` does not shift markers.** Ever.
- **Regex capture groups narrow the mark.** Use `(?:...)` if that isn't wanted.
- **Wrong import path** (`astro-expressive-code/components` in a Starlight project) is the most common `<Code>` failure.
- **Plugin meta without the plugin installed** does nothing. Check the config first.
- **`title` beats file-name comments.** If a title mysteriously appears and a comment vanished, that's extraction, not a bug — set `frame="none"` or an explicit title.
- **Long labels need a blank line** in the source to sit on. Without one they render in the gutter and collide with the code.
