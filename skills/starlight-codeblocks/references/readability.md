# Make code easier to read

Six features make a block, or the code in the prose, easier to read. None of them changes the copied text.

- If lines are needed to run the code but not to understand it, hide them with hidden lines.
- If the whole file matters but readers scan it, cap it with an expandable block.
- If every line matters but a few matter more, use focus, in [draw-attention.md](draw-attention.md).
- If the exact whitespace changes the meaning, show it with visible whitespace.
- If brackets nest deeply on dense lines, colour them with colourised brackets.
- If code is inside a sentence, colour it with inline code highlighting.
- If the reader compares one before and one after of a few lines, use a diff in one block. Word-level diff starts on its own.

## Hidden lines

Docs: https://ewels.github.io/starlight-codeblocks/features/hidden-lines/

Use for imports, settings and boilerplate that readers need to run an example but not to understand it. Each run of hidden lines goes behind a dashed marker that the reader can open. Do not hide a line that the reader must change, such as an API key. Keep it visible, or use a fill-in placeholder.

| Syntax | Where |
|---|---|
| `hidden={range}` | Fence line, such as `hidden={1-3,6-7}` |
| `[!code hide]` | Comment at the end of the line |
| `[!code hide:N]` | Comment: its line and the next N-1 lines |

```ts
import { createServer } from 'node:http'; // [!code hide]
const port = Number(process.env.PORT ?? 3000);
createServer(handler).listen(port);
```

- The copy button always copies hidden lines, so the code still runs after a paste. Playgrounds and the **Run in browser** button get them too.
- The title bar gets a "Show N hidden lines" button that opens every run.
- A line permalink to a hidden line opens its marker.
- Hidden lines that show are dimmed to 75% opacity, which puts some syntax colours under 4.5:1 contrast. Set the `codeblocksHiddenLines.openOpacity` style setting to `1` if the site needs full contrast.
- Without JavaScript, hidden lines stay hidden.
- Option: `hiddenLines: false` ignores `hidden` and leaves `[!code hide]` in the code.
- Expressive Code's `collapse={range}` comes from `@expressive-code/plugin-collapsible-sections`. It keeps a summary line for each section and works without JavaScript. Hidden lines take only a thin marker, have a directive and a show-all button, and need JavaScript to open. The docs compare them: https://ewels.github.io/starlight-codeblocks/features/hidden-lines/#hidden-lines-or-collapsible-sections

## Expandable blocks

Docs: https://ewels.github.io/starlight-codeblocks/features/expandable-blocks/

Use when a full file is the clearest example, but a reader who scans the page does not need every line at once. The block shows its first lines with a fade, and a button that shows the rest. Do not use to hide chosen lines: use hidden lines.

| Syntax | Where |
|---|---|
| `expandable` | Fence line: caps the block at the site default, 12 lines |
| `expandable={N}` | Fence line: caps the block at `N` lines |
| `expandable=false` | Fence line: turns off the `expandable.auto` option for the block |

- A block collapses only if the collapse hides three lines or more.
- Lines that hidden lines remove do not count towards `N` or the total on the button.
- A block with Expressive Code's `collapse` attribute does not collapse, even with `expandable`.
- Find in the page still finds text in the collapsed lines, in browsers that support `hidden="until-found"`.
- Without JavaScript, and when the page prints, the block shows in full.
- Option: `expandable.lines` (default `12`) sets the count for the bare `expandable` attribute.
- Option: `expandable.auto` (default `false`) makes every block with more lines than this number expandable, at `expandable.lines`. It skips the variants of a code switcher, runnable blocks, blocks with Expressive Code's `collapse` and the blocks in `<CodeWalkthrough>` and `<Scrollycoding>`.

## Visible whitespace

Docs: https://ewels.github.io/starlight-codeblocks/features/visible-whitespace/

Use when the exact whitespace character changes the meaning: a Makefile recipe needs a tab, Python needs consistent indentation, a patch has trailing spaces. Spaces show as middle dots and tabs as arrows. Do not use on blocks where whitespace does not matter, because the glyphs add noise.

| Syntax | Where |
|---|---|
| `whitespace` | Fence line: shows the leading whitespace of each line |
| `whitespace="all"` | Fence line: shows every space and tab, also between words and at the end of a line |

- Trailing whitespace shows only in fenced code blocks in Markdown and MDX. Expressive Code removes it from a block that the `<Code>` component renders.
- The glyphs are CSS. The copied text has the real spaces and tabs. Screen readers do not hear the glyphs.
- The plugin sets the Expressive Code `tabWidth` to `0` unless the site sets its own value, so tabs reach the block unchanged.
- Option: `whitespace: false` turns the feature off.

## Colourised brackets

Docs: https://ewels.github.io/starlight-codeblocks/features/colourised-brackets/

Use for lines with several levels of nested brackets. `()`, `[]` and `{}` cycle through three colours by depth. Hover over a bracket to outline it and its partner. Do not use on a short line with one level of nesting, where the colours add little.

| Syntax | Where |
|---|---|
| `brackets` | Fence line |
| `brackets=false` | Fence line. Turns off the colours for a language in `brackets.languages`. |

- Brackets in strings and comments, and brackets with no partner, keep their normal colour.
- The colours need no JavaScript. The outline on hover needs JavaScript.
- Option: `brackets.languages` (default `[]`) turns the colours on for every block in those languages, such as `['js', 'json']`. A name also covers the other names of its language (`js` covers `javascript`).
- Limits: the plugin finds strings and comments with the comment syntax of the language, not a full parser.

## Inline code highlighting

Docs: https://ewels.github.io/starlight-codeblocks/features/inline-code-highlighting/

Use for a short expression, command or declaration in a sentence. A `{:lang}` suffix gives inline code the syntax colours of the site's code blocks. The plugin removes the suffix.

| Syntax | Where |
|---|---|
| `` `<code>{:<lang>}` `` | Inside the backticks, at the end of the code. Use this form. |
| `` `<code>`{:<lang>} `` | Directly after the closing backtick. Fails in MDX. |

```md
Install the package with `pnpm add starlight-codeblocks{:sh}`, then restart the dev server.
```

- `<lang>` is any language name or alias that Expressive Code knows, such as `js`, `py`, `sh`, `css` or `html`.
- The suffix must follow the code with no space.
- MDX reads a `{:js}` after the closing backtick as a JavaScript expression, and the build fails. Put the suffix inside the backticks. `starlight-versions` and `starlight-md-txt` read `.md` files as MDX too.
- An unknown language shows as normal inline code, with a build warning.
- Inline code that contains a backtick keeps its suffix as text.
- Option: `inlineHighlighting: false` leaves the suffix in the prose as text.
- Option: `inlineHighlighting.defaultLanguage`, such as `'py'`, highlights inline code with no suffix in that language. A suffix wins over it. `{:txt}` keeps one piece of inline code plain.
- Limits: one line of code only. No attributes or directives. No token form, such as `{:.entity.name.function}`. Needs Starlight, and does not work in Markdoc files.

## Word-level diff

Docs: https://ewels.github.io/starlight-codeblocks/features/word-level-diff/

Word-level diff highlights the words that changed inside each pair of removed and added lines, so readers find a one-word edit in a long line. It has no attribute to turn it on. It applies to every removed line that has an added line below it, from any of these sources:

| Source | Where |
|---|---|
| A `diff` block, such as `diff lang="js"` | Fence line. `lang` keeps the syntax colours. |
| `ins={range}`, `del={range}` | Fence line, in a block of any language |
| `[!code ++]`, `[!code --]` | Comment at the end of the line |
| `wordDiff=false` | Fence line: turns the feature off for one block |

````md
```diff lang="js"
-const timeout = 5000;
+const timeout = options.timeout ?? 5000;
```
````

- Prefer `[!code ++]` and `[!code --]` when the block can change, because they move with their line.
- Changed words get a stronger tint. Added words are underlined, and removed words have a line through them.
- A pair that is less than 40% similar keeps the whole-line tints only.
- Needs no JavaScript.
- Option: `wordDiff.minSimilarity` (default `0.4`, from 0 to 1). Raise it to show the highlight only for close edits. `wordDiff: false` turns it off for the site.
- Limits: pairing is by position, so a run of removed lines pairs one by one with the run of added lines below it. It compares visible text and does not parse the language. It skips long pairs, such as minified code.
- Add `wordDiff=false` to a block with `[!code ++]` and `[!code --]` that shows a different feature.
