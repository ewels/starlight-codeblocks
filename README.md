<h1 align="center">
  <img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/logotype.svg" width="800" alt="starlight-codeblocks">
</h1>

A Starlight plugin that adds 24 features to code blocks, such as focus, line states, annotations, links to API docs and runnable examples. It builds on Expressive Code, so the code blocks you already have keep working.

## Install

Add the package to the site:

```sh
npm install starlight-codeblocks
```

Then add `codeblocks()` to the Starlight plugins in `astro.config.mjs`:

```js
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import codeblocks from 'starlight-codeblocks';

export default defineConfig({
  integrations: [
    starlight({
      title: 'My docs',
      plugins: [codeblocks()],
    }),
  ],
});
```

A feature starts when a code block uses its attribute or its directive, so existing pages do not change.

## Example

This code block focuses lines 4 to 7 and adds an annotation to line 5:

````md
```js title="src/config.js" focus={4-7}
import { defineConfig } from './lib.js';

export default defineConfig({
  cache: {
    dir: '.cache', // [!annotate] Relative to the root of the site.
    maxAge: 3600,
  },
  retries: 2,
});
```
````

The [documentation](https://ewels.github.io/starlight-codeblocks/) has a page for each feature, with live examples, and a reference for every option.

## Features

Each section below shows the smallest syntax for a feature and how it looks to readers. Open a section to see it.

### Start here

<details>
<summary>Comment notation</summary>

Mark lines with directives in code comments. The plugin applies each directive and removes it from the code that readers see and copy.

```ts
  port: 3000, // [!code --]
  port: Number(process.env.PORT ?? 3000), // [!code ++]
  host: 'localhost', // [!code highlight]
```

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/comment-notation.png" alt="A TypeScript block with a removed line, an added line and a highlighted line, set by comments that the reader does not see.">

[Comment notation documentation](https://ewels.github.io/starlight-codeblocks/features/comment-notation/)

</details>

### Draw attention

<details>
<summary>Focus</summary>

Blur the lines outside a range, so that readers look at the lines that you name first. Every line becomes sharp when a reader hovers over the block or moves keyboard focus into it.

````md
```js focus={4-7}
```
````

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/focus.webp" alt="A code block with four sharp lines and the other lines blurred. The pointer moves over the block and every line becomes sharp.">

[Focus documentation](https://ewels.github.io/starlight-codeblocks/features/focus/)

</details>

<details>
<summary>Line states</summary>

Tint lines as errors, warnings or notes, with an optional message after the code, like the diagnostics in a code editor.

```py
for name in sys.argv[1:]  # [!code error] SyntaxError: expected ':'
```

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/line-states.png" alt="A Python block with a red error line and a yellow warning line, each with its message after the code, and a blue info line.">

[Line states documentation](https://ewels.github.io/starlight-codeblocks/features/line-states/)

</details>

### Explain code

<details>
<summary>Annotations</summary>

Add numbered markers to lines. Each marker opens a note in a popover, so the code stays clean until a reader asks.

```yaml
python: ["3.12", "3.13"]  # [!annotate] One job per version, run in parallel.
```

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/annotations.webp" alt="A YAML block with two numbered markers. The pointer selects each marker and a note opens in a popover under it.">

[Annotations documentation](https://ewels.github.io/starlight-codeblocks/features/annotations/)

</details>

<details>
<summary>Footnotes</summary>

Add numbered badges to lines, with the notes in a list under the block, where readers see them all at once.

```py
# [!ref] Creates the application object.
app = Flask(__name__)
```

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/footnotes.webp" alt="A Python block with numbered badges on two lines and the notes in a list under the block. Selecting a badge highlights its line and its note.">

[Footnotes documentation](https://ewels.github.io/starlight-codeblocks/features/footnotes/)

</details>

<details>
<summary>Inline callouts</summary>

Put a short note in a bubble above a line, with an arrow that points at the word it explains.

```js
// [!callout /signal/] Lets `controller.abort()` cancel the request.
const res = await fetch(url, { signal: controller.signal });
```

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/inline-callouts.png" alt="A JavaScript block with a note in a bubble above a line, with an arrow that points at the word signal.">

[Inline callouts documentation](https://ewels.github.io/starlight-codeblocks/features/inline-callouts/)

</details>

<details>
<summary>Side-by-side annotations</summary>

Show the notes of an annotated block in a column beside the code, so readers see every note next to its line.

````md
```py annotations="side"
```
````

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/side-by-side-annotations.png" alt="A Python block with its notes in a column beside the code, each note next to its line.">

[Side-by-side annotations documentation](https://ewels.github.io/starlight-codeblocks/features/side-by-side-annotations/)

</details>

### Connect prose and code

<details>
<summary>Code mentions</summary>

Link a phrase in the prose to lines of the code block below it, so that readers see which lines the text is about.

````md
The [base case](#mention:base) stops the recursion.

```py
    if n == 0:  # [!mention base]
```
````

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/code-mentions.webp" alt="A paragraph with two linked phrases above a Python block. The pointer moves over each phrase and the lines it names stay sharp while the others fade.">

[Code mentions documentation](https://ewels.github.io/starlight-codeblocks/features/code-mentions/)

</details>

<details>
<summary>Scrollycoding</summary>

Explain a code block in prose steps that scroll past it, while the block stays in view and focuses the lines of each step.

````mdx
<Scrollycoding>

```js
```

<Step focus="1">Import Express.</Step>
<Step focus="3">Create the app object.</Step>

</Scrollycoding>
````

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/scrollycoding.webp" alt="Prose steps scroll past a code block that stays in view. The block focuses the lines of each step.">

[Scrollycoding documentation](https://ewels.github.io/starlight-codeblocks/features/scrollycoding/)

</details>

### Show changes

<details>
<summary>Word-level diff</summary>

Highlight the words that changed inside each line of a diff, so readers find a small edit in a long line. It applies to each removed line that an added line follows.

```diff
-const timeout = 5000;
+const timeout = options.timeout ?? 5000;
```

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/word-level-diff.png" alt="A diff block where only the changed words in each line are tinted, underlined when added and struck through when removed.">

[Word-level diff documentation](https://ewels.github.io/starlight-codeblocks/features/word-level-diff/)

</details>

<details>
<summary>Token transitions</summary>

Step through versions of one code block, and watch the code move from each version to the next, so readers see what changed.

````mdx
<CodeSteps>

```js step="Create the app"
```

```js step="Parse JSON bodies"
```

</CodeSteps>
````

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/token-transitions.webp" alt="A JavaScript block with step buttons. Selecting Next moves the code to the next version, and the new lines fade in.">

[Token transitions documentation](https://ewels.github.io/starlight-codeblocks/features/token-transitions/)

</details>

### Shorten long code

<details>
<summary>Hidden lines</summary>

Hide the imports and set-up that readers need to run an example but not to understand it. The copy button still copies every line.

````md
```py hidden={1-3,6-7}
```
````

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/hidden-lines.webp" alt="A Python block with dashed lines in place of hidden lines. Selecting a dashed line shows the hidden imports.">

[Hidden lines documentation](https://ewels.github.io/starlight-codeblocks/features/hidden-lines/)

</details>

<details>
<summary>Expandable blocks</summary>

Show the first lines of a long block, with a fade and a button to reveal the rest.

````md
```py expandable={8}
```
````

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/expandable-blocks.webp" alt="A Python block that shows its first lines with a fade and a button. Selecting the button shows every line.">

[Expandable blocks documentation](https://ewels.github.io/starlight-codeblocks/features/expandable-blocks/)

</details>

### Make code easier to read

<details>
<summary>Visible whitespace</summary>

Show spaces and tabs as faint glyphs, for the blocks where indentation changes the meaning of the code.

````md
```make whitespace
```
````

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/visible-whitespace.png" alt="A Makefile block with a faint arrow for each tab and a faint dot for each space.">

[Visible whitespace documentation](https://ewels.github.io/starlight-codeblocks/features/visible-whitespace/)

</details>

<details>
<summary>Colourised brackets</summary>

Colour matching brackets by nesting depth, so readers can match the pairs on a dense line of code.

````md
```js brackets
```
````

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/colourised-brackets.png" alt="Two lines of JavaScript. The nested brackets of the second line have a different colour for each depth.">

[Colourised brackets documentation](https://ewels.github.io/starlight-codeblocks/features/colourised-brackets/)

</details>

<details>
<summary>Inline code highlighting</summary>

Give inline code in the prose the same syntax colours as the code blocks, with a language suffix at the end of the code.

```md
Call `await fetch(url){:js}` before you read the body.
```

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/inline-code-highlighting.png" alt="A sentence with two pieces of inline code in syntax colours.">

[Inline code highlighting documentation](https://ewels.github.io/starlight-codeblocks/features/inline-code-highlighting/)

</details>

### Add links

<details>
<summary>Token links</summary>

Turn any text on a line of code into a link, with a directive in the comment above it.

```py
# [!link /linspace/ https://numpy.org/doc/stable/reference/generated/numpy.linspace.html]
x = np.linspace(0, 1, 50)
```

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/token-links.png" alt="A Python block where the word linspace is a link with a solid underline in the accent colour.">

[Token links documentation](https://ewels.github.io/starlight-codeblocks/features/token-links/)

</details>

<details>
<summary>API auto-linking</summary>

Link the names in code examples to their reference pages, with a card that shows the signature and a summary. Adapters for Python and Nextflow come with the plugin.

```py
import json
from pathlib import Path

run = json.loads(Path("run.json").read_text())
```

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/api-auto-linking.webp" alt="A Python block where library names have dotted underlines. The pointer moves over one and a card shows its signature and a summary.">

[API auto-linking documentation](https://ewels.github.io/starlight-codeblocks/features/api-auto-linking/)

</details>

<details>
<summary>Line permalinks</summary>

Give a code block line numbers that link to each line, so readers can share a link to the exact lines they mean.

````md
```yaml id="cfg"
```
````

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/line-permalinks.webp" alt="A YAML block with line numbers. Selecting a number highlights the line, and a shift-selection extends it to a range.">

[Line permalinks documentation](https://ewels.github.io/starlight-codeblocks/features/line-permalinks/)

</details>

### Adapt to the reader

<details>
<summary>Code switcher</summary>

Show one code block with several variants, such as package managers or languages, and a menu in the title bar to switch between them.

````md
:::code-switcher{sync="pm"}
```sh label="npm"
npm install starlight-codeblocks
```
```sh label="pnpm"
pnpm add starlight-codeblocks
```
:::
````

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/code-switcher.webp" alt="An npm install command with a menu in the title bar. The menu changes the command to pnpm and then to Yarn.">

[Code switcher documentation](https://ewels.github.io/starlight-codeblocks/features/code-switcher/)

</details>

<details>
<summary>Fill-in placeholders</summary>

Turn placeholders such as `YOUR_TOKEN` into fields, so readers type their own values into every block and the copied code.

````md
```sh placeholder="YOUR_TOKEN"
```
````

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/fill-in-placeholders.webp" alt="A shell block and a Python block with a YOUR_TOKEN field. Text typed in one field appears in both blocks.">

[Fill-in placeholders documentation](https://ewels.github.io/starlight-codeblocks/features/fill-in-placeholders/)

</details>

### Copy and run

<details>
<summary>Smart shell copy</summary>

Show prompts and output in terminal blocks. The Copy commands button copies the commands only, not the prompts or the output lines. It applies to every terminal block with a prompt line.

```sh
$ uv tool install ruff
Resolved 1 package in 180ms
```

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/smart-shell-copy.webp" alt="A terminal block with prompts and their output. The pointer selects the Copy commands button in the title bar. A caption below the block then shows the copied text: the commands only, without the prompts or the output.">

[Smart shell copy documentation](https://ewels.github.io/starlight-codeblocks/features/smart-shell-copy/)

</details>

<details>
<summary>Open in playground</summary>

Add a title bar button that opens the example in an online playground, with the code already filled in.

````md
```ts playground="typescript"
```
````

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/open-in-playground.png" alt="A TypeScript block with an Open in TS Playground button in its title bar.">

[Open in playground documentation](https://ewels.github.io/starlight-codeblocks/features/open-in-playground/)

</details>

<details>
<summary>Run in the browser</summary>

Add a Run button that runs the example in the browser and shows the output under the block. Python runs with Pyodide, which loads only when a reader selects **Run**.

````md
```py runnable
```
````

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/run-in-the-browser.webp" alt="A Python block with a Run button. Selecting it shows the output of the program under the block.">

[Run in the browser documentation](https://ewels.github.io/starlight-codeblocks/features/run-in-the-browser/)

</details>

## Licence

MIT
