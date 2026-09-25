# Specification

This file defines the syntax and behaviour of the first release. The first release has 24 features. `mockups.html` shows each one. Where this file and the mockups disagree about behaviour, this file wins.

Two ideas were considered and dropped: snippet import (Starlight's `<Code>` component with a `?raw` import covers it) and an Ask AI button. Do not build them.

## Contents

1. Terms
2. Architecture
3. Configuration
4. Syntax
5. Behaviour that applies to all features
6. Features: inside the code block
7. Features: across the page
8. Features: build last

## 1. Terms

Use these terms in code, tests and docs. `WRITING-STYLE.md` has the full glossary.

| Term | Meaning |
|---|---|
| Author | A person who writes pages on a Starlight site. |
| Reader | A person who visits the site. |
| Code block | A fenced code block in Markdown or MDX, rendered by Expressive Code. |
| Fence line | The opening line of a code block, for example ```` ```py title="app.py" ````. |
| Attribute | A `key=value` item or a flag on the fence line. Expressive Code calls these meta options. |
| Directive | A marker in a code comment, such as `[!code focus]`. |
| Comment notation | The system of directives. |
| Line number | The number of a line as the reader sees it. See "Line numbers" in section 4. |
| Range | A set of line numbers, such as `{1, 4-6}`. |

## 2. Architecture

### Package

One npm package. It exports:

- A default export: the Starlight plugin, `codeblocks(options)`.
- A subpath export, `<name>/expressive-code`: each feature as a separate Expressive Code plugin, and a preset, `pluginCodeblocks(options)`, for sites that use Expressive Code without Starlight.
- Subpath exports for the adapter factories: `<name>/adapters/python`, `<name>/adapters/nextflow`, `<name>/runtimes/pyodide`.
- Type definitions for everything above.

### Parts of a feature

Each feature is built from some of these parts. The spike (see `ARCHITECTURE-QUESTIONS.md`) decides how each part is registered.

| Part | Use |
|---|---|
| Expressive Code plugin | Build-time work on each code block: parse attributes and directives, add annotations, add classes, set styles, change the copy text. |
| Client module | Interaction that static HTML cannot do. Plain TypeScript, no framework. |
| Astro component | Features that span several code blocks: token transitions, scrollycoding and, if the directive route fails, the code switcher. |
| Sätteri plugin | Syntax outside code blocks: the `:::code-switcher` directive and inline code highlighting. |

### Shared parts

- One comment notation parser, used by every feature that reads directives.
- One range parser for `{1, 4-6}` syntax.
- One positioning helper for popovers and hover cards: CSS anchor positioning where the browser supports it, and a small script fallback.
- One loader for client modules, so that each page loads only the modules for the features it uses.

### Client JavaScript budget

- No client JavaScript on a page with no interactive features.
- At most 3 kB (minified and gzipped) for each feature module, except token transitions and runtimes.
- Token transitions load their animation library only on pages with a `<CodeSteps>` component.
- Runtimes load only when a reader selects Run.

### Themes and styles

- All colours and sizes come from Expressive Code style settings, so sites can override them with `styleOverrides`.
- Every colour has a dark value and a light value. The mockup colours are the dark values. Derive light values that give the same contrast against the light theme background.
- Text meets WCAG AA contrast (4.5:1). Tints, bars and outlines that carry meaning meet 3:1.
- Class names use one prefix, derived from the package name, to avoid clashes.

### Without JavaScript

Build-time features render completely. Interactive features must leave readable code on the page. Each feature section says what happens without JavaScript.

## 3. Configuration

Sites add the plugin with one line:

```js
// astro.config.mjs
starlight({
  plugins: [codeblocks()],
});
```

`codeblocks()` takes one options object. Each feature has a key. Set a key to `false` to turn the feature off, or to an object to configure it. With no options, every feature is on. Features that need client JavaScript still load nothing on pages that don't use them.

```ts
interface CodeblocksOptions {
  focus?: false | { style?: 'blur' | 'dim' };
  lineStates?: false | { states?: Record<string, LineStateDefinition> };
  notation?: false | { comments?: Record<string, string[]> };
  callouts?: false;
  annotations?: false;
  footnotes?: false | { sticky?: boolean };
  hiddenLines?: false;
  shellCopy?: false | { prompts?: string[] };
  wordDiff?: false | { minSimilarity?: number };
  whitespace?: false;
  brackets?: false | { languages?: string[] };
  tokenLinks?: false;
  apiLinks?: false | { adapters?: ApiLinkAdapter[] };
  expandable?: false | { lines?: number };
  playgrounds?: false | Record<string, PlaygroundDefinition>;
  mentions?: false;
  permalinks?: false;
  placeholders?: false | { storage?: 'local' | 'session' | 'none' };
  codeSwitcher?: false;
  transitions?: false;
  scrollycoding?: false;
  inlineHighlighting?: false;
  runnable?: false | { runtimes?: Record<string, string>; timeout?: number };
}
```

Each feature section below gives the defaults. Validate options at startup and fail the build with a clear message for unknown keys or wrong types.

## 4. Syntax

### Attributes

These attributes go on the fence line. Expressive Code's own attributes (`title`, `frame`, `mark`, `ins`, `del`, `collapse`, `wrap`, `showLineNumbers`, `startLineNumber`, `lang`) keep working unchanged.

| Attribute | Feature | Example |
|---|---|---|
| `focus={range}` | Focus | `focus={4-7}` |
| `error={range}`, `warning={range}`, `info={range}` | Line states | `error={3}` |
| `<state>={range}` | Custom line states | `todo={9}` |
| `hidden={range}` | Hidden lines | `hidden={1-3,6-7}` |
| `whitespace`, `whitespace="all"` | Visible whitespace | `whitespace` |
| `brackets` | Colourised brackets | `brackets` |
| `wordDiff=false` | Word-level diff (turn off) | `wordDiff=false` |
| `apiLinks=false` | API auto-linking (turn off) | `apiLinks=false` |
| `expandable`, `expandable={N}` | Expandable blocks | `expandable={8}` |
| `playground="<name>"` | Open in playground | `playground="typescript"` |
| `id="<id>"` | Line permalinks | `id="cfg"` |
| `placeholder="<A>,<B>"` | Fill-in placeholders | `placeholder="YOUR_TOKEN"` |
| `annotations="side"` | Side-by-side annotations | `annotations="side"` |
| `footnotes="sticky"` | Footnotes | `footnotes="sticky"` |
| `label="<text>"` | Code switcher | `label="pnpm"` |
| `step="<text>"` | Token transitions | `step="Parse JSON bodies"` |
| `runnable` | Run in the browser | `runnable` |

### Comment notation

A directive is a marker in a comment, written in the comment syntax of the block's language.

There are two kinds:

- End-of-line directives apply to the line they are on.
- Own-line directives take a whole line and apply to the line directly below. The plugin removes the line that holds the directive.

| Directive | Kind | Feature |
|---|---|---|
| `[!code highlight]` | End of line | Expressive Code `mark` |
| `[!code ++]`, `[!code --]` | End of line | Expressive Code `ins`, `del` |
| `[!code focus]` | End of line | Focus |
| `[!code error] <message>` | End of line | Line states (message optional) |
| `[!code warning] <message>` | End of line | Line states |
| `[!code info] <message>` | End of line | Line states |
| `[!code <state>] <message>` | End of line | Custom line states |
| `[!code hide]` | End of line | Hidden lines |
| `[!annotate] <text>` | End of line | Annotations |
| `[!mention <name>]` | End of line | Code mentions |
| `[!callout /<text>/] <text>` | Own line | Inline callouts |
| `[!ref] <text>` | Own line | Footnotes |
| `[!link /<text>/ <url>]` | Own line | Token links |

Rules:

- Every `[!code …]` directive accepts `:N`. It then applies to its own line and the next N-1 lines. `[!code focus:3]` focuses three lines.
- The `[!code …]` directives match VitePress, so VitePress pages work unchanged.
- The plugin removes each directive from the rendered code and from the copied text. If a comment holds only directives, the plugin removes the whole comment and any whitespace before it.
- `/<text>/` in a directive matches the first occurrence of that literal text on the target line. It is not a regular expression.
- `[\!code focus]` (with a backslash) renders as the literal text `[!code focus]`. The same escape works for every directive.
- Inline code, links and bold in directive text (annotations, callouts, footnotes, messages) render as HTML. Nothing else does.
- If a directive has an unknown name, or its `/<text>/` has no match on the target line, log a build warning with the file and line, and render the line without that directive's effect.

Comment syntax by language:

| Comment | Languages (defaults) |
|---|---|
| `//` | JavaScript, TypeScript, JSX, TSX, Rust, Go, Java, Kotlin, Swift, C, C++, C#, Groovy, Nextflow, Scala, Dart, PHP |
| `#` | Python, Shell, Bash, Zsh, PowerShell, YAML, TOML, Ruby, R, Perl, Makefile, Dockerfile, Nix |
| `--` | SQL, Lua, Haskell |
| `<!-- -->` | HTML, XML, Markdown, MDX, Vue, Svelte, Astro templates |
| `/* */` | CSS, SCSS, Less |
| `%` | TeX, LaTeX, Erlang |
| `;` | Lisp, Clojure, INI |

Sites can extend or replace this map with the `notation.comments` option. Languages with no comment syntax, such as JSON, cannot use directives. Authors use `jsonc` or attributes instead.

### Line numbers

All line numbers in attributes and in the reader's view refer to the lines the reader sees. Own-line directives are removed first, so they do not count. Hidden lines count, because they are part of the code.

### Ranges

`{3}`, `{3-5}` and `{1, 4-6}` are valid. Ranges can overlap and can come in any order. A number outside the block is ignored with a build warning. Anything else is a build error that names the file and the attribute.

## 5. Behaviour that applies to all features

### Copied text

The copy button copies the code that a reader would run:

- All directives are removed.
- Messages, annotations, callouts and footnotes are left out.
- Hidden lines are included.
- Placeholder fields contribute the reader's value, or the placeholder text if the field is empty.
- Terminal blocks with prompts copy commands only (see Smart shell copy).

Manual text selection gives the same result where the browser allows it. Decorations such as whitespace glyphs and line-state labels must not appear in a manual copy.

### Keyboard and focus

- Every control is a native `button`, `a`, `input` or `select`.
- Every control has a visible focus style that meets 3:1 contrast.
- Hover behaviour also happens on keyboard focus.
- Escape closes any open popover or hover card.

### Motion

Under `prefers-reduced-motion: reduce`, all transitions and animations stop. State changes still happen, instantly.

### Print

- Expandable blocks print in full.
- Annotations print as a numbered list under the block.
- Hidden lines stay hidden.
- Interactive controls do not print.

### Layout

- The page body must never scroll sideways. Wide code scrolls inside its block.
- Features work in Starlight's default content width and on screens 360 px wide.
- Code stays left to right on right-to-left pages. Expressive Code already handles this.

## 6. Features: inside the code block

### 6.1 Focus

Blurs the lines that don't matter, so readers look at the ones that do.

Syntax: `focus={range}`, `[!code focus]`, `[!code focus:N]`.

Behaviour:

- Lines outside the focus are blurred (1.1 px) and faded (opacity 0.48).
- Hovering over the block, or moving keyboard focus into it, shows every line clearly, with a 250 ms transition.
- If no line is focused, the block renders exactly as it would without the plugin.
- The copy button copies the whole block.

Options: `focus.style` is `'blur'` (default) or `'dim'`. Dim fades lines without blurring them. Style settings: blur radius, opacity, transition duration.

Accessibility: blurred lines stay in the page for screen readers. The code area takes keyboard focus (`tabindex="0"`) when the block has focused lines.

Without JavaScript: works completely.

### 6.2 Line states

Tints lines as errors, warnings or notes, with an optional message at the end of the line.

Syntax: `error={range}`, `warning={range}`, `info={range}`, or `[!code error] <message>` and the same for the other states. Custom states use their own names.

Behaviour:

- Each state has a background tint and a 3 px bar on the left edge.
- A message renders after the code as a small label. The label starts with the state name ("Error", "Warning", "Note") in bold, then the message.
- Every state line also has a visually hidden prefix, such as "Error:", for screen readers.
- Messages are not copied.

Options: `lineStates.states` adds custom states:

```js
lineStates: {
  states: {
    todo: { label: 'To do', colour: { dark: '#c792ea', light: '#7c3aed' } },
  },
}
```

Without JavaScript: works completely.

### 6.3 Comment notation

The notation system in section 4, as a feature authors can turn off. With `notation: false`, directives render as ordinary comments. Section 4 defines the syntax. The docs need a reference page that lists every directive and a guide for migrating from VitePress.

### 6.4 Inline callouts

A short note in a bubble directly above a line, pointing down at the text it explains.

Syntax: an own-line directive, `[!callout /<text>/] <note>`, directly above the target line. Without `/<text>/`, the arrow points at the first character that is not whitespace.

Behaviour:

- The directive line is removed. The bubble renders in its place, above the target line.
- The arrow is centred on the middle of the matched text, and its tip sits about 3.5 px above the line.
- The bubble's left edge sits 40 px to the left of the arrow, but never closer than 8 px to the block's edge.
- The bubble is at most 60 characters wide, or 90% of the block, whichever is smaller. Longer notes wrap inside it.
- A callout applies only to the line directly below it. Two callout lines above one target line give two bubbles, stacked in order.
- Callouts are not copied.

Accessibility: the bubble is in the reading order before its line. It has `role="note"`.

Without JavaScript: works completely.

### 6.5 Annotations

Numbered markers at the end of lines that open an explanation.

Syntax: `[!annotate] <text>` at the end of a line.

Behaviour:

- Each annotation becomes a round, numbered button after the code on its line. Numbers start at 1 in each block and follow line order.
- Selecting a button opens a popover with the text, positioned under the button, or above it if there is no room below.
- The native `popover` attribute handles opening, light dismiss and Escape. Opening one annotation closes any other.
- Annotations are not copied.

Accessibility: each button has the label "Annotation N". The popover follows the button in the reading order.

Without JavaScript: the native `popover` attribute works without script. Positioning falls back to the browser default.

### 6.6 Footnotes

Numbered badges on lines, with the explanations in a list under the block.

Syntax: an own-line directive, `[!ref] <text>`, directly above the target line. `footnotes="sticky"` on the fence line makes the list sticky.

Behaviour:

- Each footnote adds a numbered badge after the code on the target line, and an item to the list under the block.
- Selecting a badge highlights the whole target line and its list item, and scrolls the list item into view if it is not visible.
- Selecting a list item highlights the item and the whole target line, and scrolls the line into view if it is not visible.
- Selecting anywhere else clears the highlight.
- With `footnotes="sticky"`, the list sticks to the bottom of the viewport while any part of the block is on screen.
- Footnotes are not copied.

Options: `footnotes.sticky` sets the default for the site. The default is `false`.

Without JavaScript: badges and list items are links to each other's anchors, so they still work, without the highlight.

### 6.7 Hidden lines

Hides the imports and set-up that readers need to run an example but not to understand it.

Syntax: `hidden={range}`, `[!code hide]`, `[!code hide:N]`.

Behaviour:

- Hidden lines are not shown. A marker sits where each run of hidden lines starts: a dashed line across the block, with the text "N hidden lines" at the left.
- Selecting a marker shows or hides that run only. When the run shows, the marker text is "Hide N lines", and the lines have a faint background.
- The title bar has a button, "Show N hidden lines", where N is the total. It shows every run. If every run is showing, it reads "Hide N lines" and hides them all.
- The copy button always includes hidden lines.

Accessibility: markers and the title bar button use `aria-expanded` and `aria-controls`.

Without JavaScript: hidden lines stay hidden, and the markers do nothing.

### 6.8 Smart shell copy

Terminal blocks can show prompts and output, but the copy button copies only the commands.

Applies to: blocks with a terminal frame (Expressive Code's `frame="terminal"`, or its automatic terminal frame for shell languages) that have at least one prompt line.

Behaviour:

- A line that starts with a prompt is a command. The prompt is styled separately and cannot be selected.
- A line that ends with a backslash continues the command on the next line.
- Every other line is output, shown in a muted colour.
- The copy button's label is "Copy commands". It copies the commands without prompts, one per line, with continuation lines kept.

Options: `shellCopy.prompts`, default `['$ ', '> ']`. `#` is not a default, because it is also a comment.

Without JavaScript: the copy button needs JavaScript, as in Expressive Code.

### 6.9 Word-level diff

Highlights only the words that changed, not whole lines.

Applies to: every removed line directly followed by an added line, from `diff` blocks, `ins` and `del` attributes, or `[!code --]` and `[!code ++]`.

Behaviour:

- A run of removed lines followed by a run of added lines is paired line by line.
- Each pair is compared token by token (longest common subsequence over word, whitespace and punctuation tokens).
- Changed tokens get a stronger tint. Whitespace between two changed tokens is part of the highlight.
- If a pair is less than 40% similar, it keeps whole-line tints only.
- Syntax highlighting of the underlying language stays in place.

Options: `wordDiff.minSimilarity`, default 0.4. `wordDiff=false` on a fence line turns it off for that block.

Without JavaScript: works completely.

### 6.10 Visible whitespace

Shows spaces and tabs as faint glyphs.

Syntax: `whitespace` (leading whitespace only) or `whitespace="all"`.

Behaviour:

- A space shows as a middle dot and a tab as an arrow, filling the tab's width.
- Glyphs are drawn with CSS, so a manual copy gives the real characters.

Accessibility: glyphs are hidden from screen readers.

Without JavaScript: works completely.

### 6.11 Colourised brackets

Colours matching brackets by nesting depth.

Syntax: `brackets` on the fence line. The `brackets.languages` option turns it on for every block in the listed languages.

Behaviour:

- `()`, `[]` and `{}` cycle through three colours by depth. Brackets in strings and comments keep their normal colour.
- A bracket without a partner keeps its normal colour.
- Hovering over a bracket, or focusing the code and moving the caret, outlines the bracket and its partner. Hover is the requirement; caret support is optional.

Options: `brackets.languages`, default none. Style settings: the three colours for each theme.

Without JavaScript: colours work. The partner outline needs JavaScript.

### 6.12 Token links

Turns any text on a line into a link.

Syntax: an own-line directive, `[!link /<text>/ <url>]`, directly above the target line. Several link lines can stack above one target line.

Behaviour: the first match of the text becomes a link, with a subtle underline. Site-relative URLs respect Astro's `base`.

Without JavaScript: works completely.

### 6.13 API auto-linking

Names in examples link to their reference pages, with a hover card.

Authors write nothing. The feature runs on every block in a language that has an adapter, unless the block has `apiLinks=false`.

Adapter interface:

```ts
interface ApiLinkAdapter {
  name: string;
  languages: string[];
  // Runs once per build. Loads or fetches indexes.
  setup(context: AdapterContext): Promise<void>;
  // Finds names that can be links. Offsets are into the rendered code.
  findSymbols(code: string, language: string): SymbolRef[];
  // Returns null when the adapter is not certain.
  resolve(symbol: SymbolRef): Resolution | null;
}
interface SymbolRef { start: number; end: number; name: string; context?: unknown }
interface Resolution {
  href: string;
  kind?: string;        // for example "function", "class", "process"
  signature?: string;
  summary?: string;     // first sentence of the docs
  source: string;       // shown at the bottom of the card
}
```

Behaviour:

- Resolved names become links, with a dotted underline that turns solid on hover and focus.
- Hovering over a link for 150 ms, or focusing it, shows a card: the signature (or the qualified name and kind), the summary if there is one, and the source.
- Escape or moving away hides the card.
- Names that the adapter cannot resolve with certainty stay plain text.
- Names inside strings and comments are never linked.

Python adapter (`adapters/python`), shipped first:

- It reads `import x`, `import x as y` and `from a import b as c` in the block.
- It resolves names and attribute chains through those imports, for example `json.loads`.
- It infers a type only in cases it is certain about, for example `Path(...).read_text` after `from pathlib import Path`.
- Indexes:
  - The project's own API from starlight-pydocs, if the site uses it. The spike finds out how starlight-pydocs exposes its object data.
  - Any number of Sphinx `objects.inv` inventories, fetched at build time and cached. The Python standard library inventory is on by default.
- `objects.inv` has no signatures or summaries. Cards for those names show the qualified name, the kind and the source. The mockup shows a signature for `json.loads`, which is not possible from `objects.inv` alone.

Nextflow adapter (`adapters/nextflow`), shipped second, to prove the interface:

- It resolves channel factories (`channel.of`, `channel.fromPath`, `channel.fromFilePairs` and the rest) and operators called on channels, against the Nextflow reference docs. It uses a bundled map of names to URLs, signatures and summaries. Check every bundled URL during development.
- It resolves processes and workflows named in `include { … } from '…'` against the pipeline's own module reference, through a URL pattern option:

```js
nextflow({
  modules: ({ name, path }) => `/reference/modules/${name.toLowerCase()}/`,
})
```

Options: `apiLinks.adapters`, default `[python()]` with the standard library inventory, plus `nextflow()`. Sites can add their own adapters.

Without JavaScript: links work. Cards need JavaScript.

### 6.14 Expandable blocks

Long blocks show their first lines, with a fade and a button to show the rest.

Syntax: `expandable` (the site default, 12 lines) or `expandable={N}`.

Behaviour:

- The block shows N lines, with a fade over the last line.
- A bar under the code has a button, "Show all X lines". After expanding, it reads "Show fewer lines".
- A block is only collapsed if collapsing hides at least 3 lines.
- The collapsed lines use `hidden="until-found"` where the browser supports it, so find-in-page reveals them and expands the block.

Options: `expandable.lines`, default 12.

Without JavaScript: the block shows in full.

### 6.15 Open in playground

A button in the title bar that opens the example in an online playground.

Syntax: `playground="<name>"`.

Built-in playgrounds:

| Name | Label | How |
|---|---|---|
| `typescript` | Open in TS Playground | `https://www.typescriptlang.org/play#code/` followed by the code compressed with lz-string's `compressToEncodedURIComponent` |
| `rust` | Open in Rust Playground | `https://play.rust-lang.org/?version=stable&mode=debug&edition=2024&code=` followed by the URL-encoded code |

Custom playgrounds:

```ts
interface PlaygroundDefinition {
  label: string;
  // One of these two:
  url?: (input: { code: string; lang: string; title?: string }) => string;
  post?: (input: { code: string; lang: string; title?: string }) => {
    action: string;
    fields: Record<string, string>;
  };
}
```

Behaviour:

- A `url` playground renders as a link styled as a button. It opens in a new tab.
- A `post` playground renders as a `form` with hidden fields and `target="_blank"`, so it needs no script.
- The code sent is the copied text (see section 5).
- If the block has placeholders, a small script updates the link or fields as the reader types.
- If a URL is longer than 8,000 characters, log a build warning.

Without JavaScript: works, except for placeholder values.

## 7. Features: across the page

### 7.1 Code mentions

Hovering over a phrase in the prose highlights the lines it refers to.

Syntax: `[!mention <name>]` at the end of each line to tag, and a link to `#mention:<name>` in the prose.

Behaviour:

- A link pairs with the next code block in the same section that has lines tagged with that name. If there is none, it pairs with the nearest previous block.
- Hovering over or focusing the link highlights the tagged lines (tint and bar) and fades the other lines of that block to opacity 0.42.
- Selecting the link scrolls the block into view if it is not visible.
- A link with no matching block renders as plain text, and the dev server logs a warning.

Docs: explain that `starlight-links-validator` flags `#mention:` links unless the site excludes them, and show the setting that excludes them.

Without JavaScript: the links do nothing.

### 7.2 Line permalinks

Selecting a line number gives a link to that line.

Syntax: `id="<id>"` on the fence line. This turns on line numbers for that block.

Behaviour:

- Line numbers become links to `#<id>-L<n>`.
- Selecting a number highlights the line and updates the address with `history.replaceState`, without scrolling.
- Shift-selecting a second number highlights the range between them, as `#<id>-L<a>-L<b>`.
- When the page loads, or the hash changes, the script highlights the lines in the hash and scrolls them into view.
- Two blocks with the same `id` on one page cause a build warning.

Without JavaScript: the links go to the block, without the highlight.

### 7.3 Fill-in placeholders

Placeholders become input fields, and what the reader types fills every block on the site.

Syntax: `placeholder="<A>,<B>"` lists the literal strings to turn into fields.

Behaviour:

- Every occurrence of each string in the block becomes an `input`. The field shows the placeholder text until the reader types.
- A field is exactly as wide as its text: the longer of the placeholder and the value, with no extra space.
- Fields keep the colour of the token they are in, such as a string.
- Typing in a field updates every field with the same name on the page, and on other pages when they load.
- Escape in a field clears its value.
- The copy button, playground links and runnable code use the reader's values.

Options: `placeholders.storage` is `'local'` (default, saved across visits), `'session'` (this tab only) or `'none'`.

Accessibility: each field's accessible name is its placeholder text.

Without JavaScript: fields are plain editable inputs that do not sync, and the copied text uses the placeholders.

### 7.4 Code switcher

One block with several variants and a menu in the title bar.

Syntax, in Markdown:

````md
:::code-switcher{sync="pm"}
```sh label="npm"
npm install <name>
```
```sh label="pnpm"
pnpm add <name>
```
:::
````

Behaviour:

- The fenced code blocks inside the directive become one block. The directive can contain only fenced code blocks.
- The title bar has a `select` menu on the right. Each entry is the fence's `label`, or the language's display name if there is no label.
- The title bar shows the active variant's `title`, if it has one.
- Blocks with the same `sync` key switch together, matched by label. The choice is saved per key in `localStorage` and applies across the site.
- If a block does not have the saved label, it shows its first variant.

If the spike shows that a Sätteri plugin cannot handle the directive, build `<CodeSwitcher sync="…">` as an MDX component instead, and record the decision.

Without JavaScript: the first variant shows and the menu is hidden.

### 7.5 Token transitions

Steps through versions of a block, animating the code between them.

Syntax, in MDX:

````mdx
<CodeSteps>

```js title="server.js" step="Create the app"
…
```

```js title="server.js" step="Parse JSON bodies"
…
```

</CodeSteps>
````

Behaviour:

- The title bar shows, from left to right: the title, the numbered steps, the current step's label, and at the far right, Previous and Next buttons.
- The steps are round, numbered buttons joined by short lines. Steps up to the current one, and the lines between them, are filled. The current step is solid.
- The step label is hidden below 640 px.
- Previous is disabled on the first step and Next on the last.
- The arrow keys move between steps when a step button has focus.
- Changing step animates tokens with `@shikijs/magic-move` in its precompiled mode, fed with Expressive Code's tokens. Unchanged tokens move, removed tokens fade out, new tokens fade in. Duration about 500 ms.
- The copy button copies the current step.

Without JavaScript: every step renders as a separate block, in order, with its label after the title.

### 7.6 Scrollycoding

Prose steps scroll past a sticky code block, and each step changes the focus.

Syntax, in MDX:

````mdx
<Scrollycoding>

```js title="server.js"
…
```

<Step focus="1">Import Express.</Step>
<Step focus="6-8">Answer health checks with a small JSON payload.</Step>

</Scrollycoding>
````

Behaviour:

- On wide screens, the steps are a column on the left and the code block is on the right. The block sticks below Starlight's header while the steps scroll with the page.
- The active step is the one that crosses the middle of the viewport. The active step is at full opacity and the others are faded.
- Changing step changes the focused lines, with the Focus transition.
- Steps can contain any Markdown. A step can also take `mark="<range>"`.
- On narrow screens, each step is followed by its own copy of the block, focused for that step.
- The mockup scrolls inside a frame. The real component uses normal page scrolling.

Without JavaScript: the narrow-screen layout, at every width.

### 7.7 Side-by-side annotations

Annotations in a column beside the code.

Syntax: `annotations="side"` on a block that uses `[!annotate]`.

Behaviour:

- When the block's container is at least 640 px wide, the code and the notes are two columns (about 1.65 to 1).
- The notes column starts level with the top of the block. It sticks below Starlight's header while the block scrolls past.
- If the notes column is taller than the space below the header, it does not stick.
- Each line with an annotation shows a small number that matches its note.
- Hovering over or focusing a note highlights its line. Hovering over a line highlights its note.
- In narrower containers, the notes are a numbered list under the block.

Without JavaScript: the layout works. The hover link needs JavaScript.

## 8. Features: build last

### 8.1 Inline code highlighting

Syntax colours for inline code in prose.

Syntax: `` `await fetch(url)`{:js} ``, the convention from rehype-pretty-code.

Behaviour:

- The inline code uses the site's Expressive Code theme: its background and its token colours, for the light and the dark theme.
- The `{:lang}` suffix is removed.
- An unknown language renders as normal inline code, with a build warning.

This needs a Sätteri plugin with access to a highlighter. The spike looks for the right hook. If no hook works, record the options you tried in `DECISIONS.md` and mark the step as blocked.

### 8.2 Run in the browser

A Run button runs the example in the browser and shows the output.

Syntax: `runnable` on the fence line.

Runtime interface:

```ts
interface Runtime {
  load(): Promise<void>;
  run(code: string, options: { signal: AbortSignal }): Promise<{ stdout: string; stderr: string }>;
}
```

A runtime module's default export is a `Runtime`. Sites map languages to runtime modules:

```js
runnable: {
  runtimes: {
    python: '<name>/runtimes/pyodide',
    javascript: './src/runtimes/sandbox.ts',
  },
}
```

Behaviour:

- The title bar has a Run button. After the first run, it reads "Run again".
- On the first run, the output panel under the block shows "Loading the Python runtime…" (using the language's display name) while the runtime loads.
- The output panel has the label "Output". Standard error shows in the error colour.
- A run stops after `runnable.timeout` milliseconds (default 10,000), with a message in the panel.
- The code run is the copied text (see section 5).
- The Pyodide runtime runs in a web worker, so the page stays responsive. It loads Pyodide from a pinned CDN URL, which sites can change.
- No runtime code loads before a reader selects Run.

Accessibility: the output panel is an `aria-live="polite"` region.

Keep the runtime interface to the two functions above. Do not add a plugin system around it.

Without JavaScript: the Run button is hidden.
