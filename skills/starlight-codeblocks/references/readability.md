# Make code easier to read

Five features make a block, or the code in the prose, easier to read. None of them changes the copied text.

- If lines are needed to run the code but not to understand it, hide them with hidden lines.
- If the whole file matters but readers scan it, cap it with an expandable block.
- If every line matters but a few matter more, use focus, in [draw-attention.md](draw-attention.md).
- If the exact whitespace changes the meaning, show it with visible whitespace.
- If brackets nest deeply on dense lines, colour them with colourised brackets.
- If code is inside a sentence, colour it with inline code highlighting.

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

- The copy button always copies hidden lines, so the code still runs after a paste. Playgrounds and the **Run** button get them too.
- The title bar gets a "Show N hidden lines" button that opens every run.
- A line permalink to a hidden line opens its marker.
- Without JavaScript, hidden lines stay hidden.
- Option: `hiddenLines: false` ignores `hidden` and leaves `[!code hide]` in the code.
- Limits: hidden lines take no space until opened. Expressive Code's `collapse` differs: it keeps a line for its label.

## Expandable blocks

Docs: https://ewels.github.io/starlight-codeblocks/features/expandable-blocks/

Use when a full file is the clearest example, but a reader who scans the page does not need every line at once. The block shows its first lines with a fade, and a button that shows the rest. Do not use to hide chosen lines: use hidden lines.

| Syntax | Where |
|---|---|
| `expandable` | Fence line: caps the block at the site default, 12 lines |
| `expandable={N}` | Fence line: caps the block at `N` lines |

- A block collapses only if the collapse hides three lines or more.
- Find in the page still finds text in the collapsed lines, in browsers that support `hidden="until-found"`.
- Without JavaScript, and when the page prints, the block shows in full.
- Option: `expandable.lines` (default `12`) sets the count for the bare `expandable` attribute.

## Visible whitespace

Docs: https://ewels.github.io/starlight-codeblocks/features/visible-whitespace/

Use when the exact whitespace character changes the meaning: a Makefile recipe needs a tab, Python needs consistent indentation, a patch has trailing spaces. Spaces show as middle dots and tabs as arrows. Do not use on blocks where whitespace does not matter, because the glyphs add noise.

| Syntax | Where |
|---|---|
| `whitespace` | Fence line: shows the leading whitespace of each line |
| `whitespace="all"` | Fence line: shows every space and tab, also between words |

- The glyphs are CSS. The copied text has the real spaces and tabs. Screen readers do not hear the glyphs.
- The plugin sets the Expressive Code `tabWidth` to `0` unless the site sets its own value, so tabs reach the block unchanged.
- Option: `whitespace: false` turns the feature off.

## Colourised brackets

Docs: https://ewels.github.io/starlight-codeblocks/features/colourised-brackets/

Use for lines with several levels of nested brackets. `()`, `[]` and `{}` cycle through three colours by depth. Hover over a bracket to outline it and its partner. Do not use on a short line with one level of nesting, where the colours add little.

| Syntax | Where |
|---|---|
| `brackets` | Fence line |

- Brackets in strings and comments, and brackets with no partner, keep their normal colour.
- The colours need no JavaScript. The outline on hover needs JavaScript.
- Option: `brackets.languages` (default `[]`) turns the colours on for every block in those languages, such as `['js', 'json']`.
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
- Limits: one line of code only. No attributes or directives. No token form, such as `{:.entity.name.function}`. Needs Starlight, and does not work in Markdoc files.
