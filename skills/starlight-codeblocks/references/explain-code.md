# Explain code

Five features attach an explanation to lines of code: inline callouts, annotations, footnotes, side-by-side annotations and scrollycoding. Code mentions link the prose around a block to its lines. All of them keep the explanation out of the copied code.

| Style | Reader sees the note | Note goes |
|---|---|---|
| Inline callout | At once | Above the line, with an arrow at one name |
| Annotation | After a selection | In a popover under a marker |
| Footnote | At once | In a list under the block |
| Side-by-side annotation | At once | In a column beside the code, on a wide screen |
| Scrollycoding | As each step scrolls past | In prose steps next to the block |

Rules to choose:

- If the note is about one name and fits in one short sentence, use a callout.
- If most readers can skip the note, use an annotation.
- If readers need every note, use footnotes for short blocks and side-by-side annotations for long blocks.
- If the explanation is several paragraphs that walk through one block, use scrollycoding.
- If the prose already explains the lines, use code mentions to connect the two.
- Use one style in a block, so that readers find every note in the same way.

## Inline callouts

Docs: https://ewels.github.io/starlight-codeblocks/features/inline-callouts/

Use for a note of one short sentence about one word or name on a line. The bubble is always visible, so keep to one or two callouts in a block. Do not use for a note about several lines: use annotations or footnotes.

| Syntax | Where |
|---|---|
| `[!callout /text/] note` | Comment on its own line, directly above the target line |
| `[!callout] note` | The same, with the arrow at the first character that is not a space |

```js
const controller = new AbortController();
// [!callout /signal/] Lets `controller.abort()` cancel the request.
const res = await fetch(url, { signal: controller.signal });
```

- The arrow points at the first match of `/text/` on the line below.
- Two callout lines above one line give two bubbles, in source order.
- The bubble is at most 60 characters wide, or 90% of the block. Longer notes wrap.
- Works without JavaScript. Screen readers read the bubble before its line.
- Option: `callouts: false` turns the feature off. The directive line then stays in the code.
- Limits: tabs after other characters on the line can move the arrow if the site sets a `tab-size` other than 8. With `wrap`, the arrow points at the first row of the line.

## Annotations

Docs: https://ewels.github.io/starlight-codeblocks/features/annotations/

Use when the note is long, or when most readers can skip it. The code stays as compact as a plain block. Do not use when readers need every note to follow the code: use footnotes or side-by-side annotations.

| Syntax | Where |
|---|---|
| `[!annotate] note` | Comment at the end of the line it explains |
| `annotations="side"` | Fence line: shows the notes beside the code (see below) |

```yaml
matrix:
  python: ["3.12", "3.13"]  # [!annotate] One job per version, run in parallel.
```

- Markers are numbered from 1 in each block. Selecting a marker opens its note. Escape closes it.
- The note can hold inline code, links and bold text.
- Works without JavaScript, through the browser's `popover` attribute.
- When the page prints, the notes print as a numbered list under the block.
- Option: `annotations: false` turns off annotations and side-by-side annotations.
- Limits: an annotation applies to one line. For a range, put it on the first line. Long notes make long source lines.

## Footnotes

Docs: https://ewels.github.io/starlight-codeblocks/features/footnotes/

Use when every reader needs every note, and the block is short enough that the list stays close to the lines. Each line gets a numbered badge, and the notes are a numbered list under the code.

| Syntax | Where |
|---|---|
| `[!ref] note` | Comment on its own line, directly above the line it explains |
| `footnotes="sticky"` | Fence line: keeps the list at the bottom of the window while the block is on screen |
| `footnotes="static"` | Fence line: turns the sticky list off for one block |

```py
# [!ref] Creates the application object.
app = Flask(__name__)
```

- Selecting a badge highlights its line and its note. Selecting a note does the same from the list.
- Without JavaScript, the badges and the numbers are plain links to each other.
- Option: `footnotes.sticky` (default `false`) makes every list sticky. `footnotes: false` turns the feature off.
- Limits: a footnote applies to one line. A sticky list covers the bottom of the block, so keep the notes short.

## Side-by-side annotations

Docs: https://ewels.github.io/starlight-codeblocks/features/side-by-side-annotations/

Use for a longer block that you explain step by step, where readers need every note. Write the notes with `[!annotate]`, and add `annotations="side"` to the fence line.

````md
```py title="report.py" annotations="side"
with path.open() as fh:  # [!annotate] Opens the file and closes it when the block ends.
    return list(csv.DictReader(fh))  # [!annotate] Each row becomes a dict keyed by the header line.
```
````

- In a container of 600 px or more, the notes are a column beside the code. The column sticks below the site header.
- In a narrower container, such as on a phone, the notes are a numbered list under the block.
- Hovering over a note, or focusing it, highlights its line. Hovering over a line highlights its note.
- No options of its own. `annotations: false` turns it off.
- Limits: each note is next to its number, not next to its line. Long lines scroll inside the narrower code column.

## Scrollycoding

Docs: https://ewels.github.io/starlight-codeblocks/features/scrollycoding/

Use for a walkthrough of one code block in prose steps. On a wide screen, the steps scroll in a column and the block stays in view. The step at the middle of the window sets the focus of the block. Do not use when the code changes between steps: use token transitions.

| Syntax | Where |
|---|---|
| `<Scrollycoding>` ... `</Scrollycoding>` | Around one code block and its steps, in an MDX file |
| `<Step>` ... `</Step>` | After the code block, one for each step |
| `focus="<range>"` | On `<Step>`: a range without braces, such as `6-8` |
| `mark="<range>"` | On `<Step>`: marks lines as well |

````mdx
import { Scrollycoding, Step } from 'starlight-codeblocks/components';

<Scrollycoding>

```js title="server.js"
import express from 'express';

const app = express();
app.listen(3000);
```

<Step focus="1">Import Express.</Step>
<Step focus="3">Create the app object that holds routes and middleware.</Step>
<Step focus="4">Start listening on port 3000.</Step>

</Scrollycoding>
````

- Put one code block first, then the steps. Leave an empty line after `<Scrollycoding>` and before `</Scrollycoding>`.
- A step can contain any Markdown.
- The two columns need a content width of 600 px. On a narrow screen, and without JavaScript, each step shows its own copy of the block.
- Option: `scrollycoding: false` shows the narrow layout at every width, with no script.
- Limits: MDX only. One code block for each `<Scrollycoding>`. A `focus` attribute on the fence line has no effect. Many steps with a long block make a long page on phones.

## Code mentions

Docs: https://ewels.github.io/starlight-codeblocks/features/code-mentions/

Use when the prose explains the block line by line, such as "the base case stops the recursion". A link in the prose highlights the lines that it names. Do not use for lines that every reader must see at once: use focus.

| Syntax | Where |
|---|---|
| `[!mention <name>]` | Comment at the end of each line that belongs to the name |
| `[text](#mention:<name>)` | A link in the prose |

````md
The [base case](#mention:base) stops the recursion.

```py
def factorial(n):
    if n == 0:  # [!mention base]
        return 1  # [!mention base]
    return n * factorial(n - 1)
```
````

- A name is one word, such as `base` or `parse-args`. One line can have more than one tag.
- A link pairs with the next block in the same section that has the name. A section ends at the next heading. If no block follows, the link pairs with the nearest block before it.
- A link with no matching block shows as plain text, with a build warning.
- `starlight-links-validator` reports `#mention:` links as broken. Give it `exclude: linksValidatorExclude`.
- Option: `mentions: false` turns the feature off.
- Limits: the build check does not see tags in a block from the `<Code>` component.
