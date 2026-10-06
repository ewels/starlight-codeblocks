<h1 align="center">
  <img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/logotype.svg" width="800" alt="starlight-codeblocks">
</h1>

A Starlight and Astro plugin that adds 26 features to code blocks, such as focus, line states, annotations, links to API docs and runnable examples. It builds on Expressive Code, so the code blocks you already have keep working.

Using an agent? [Point it at the bundled skill](https://ewels.github.io/starlight-codeblocks/agent-skill/).

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

On an Astro site without Starlight, add `codeblocks()` from `starlight-codeblocks/astro` to `integrations` instead. The [Astro without Starlight](https://ewels.github.io/starlight-codeblocks/astro-without-starlight/) page gives the details.

Most features start only when a code block uses their attribute, or a [comment notation](https://ewels.github.io/starlight-codeblocks/comment-notation/) directive such as `# [!code focus]`. A few, such as file icons and colour swatches, apply to every matching block.

The [documentation](https://ewels.github.io/starlight-codeblocks/) has a page for each feature, with live examples, and a reference for every option.

## Features

Each section below shows the smallest syntax for a feature and how it looks to readers. Open a section to see it.

### Explain code

<details>
<summary>Annotations</summary>

Add numbered markers to lines. Each marker opens a note in a popover, so the code stays clean until a reader asks.

```yaml
runs-on: ubuntu-latest # [!annotate] Uses the Ubuntu GitHub Actions runner.
```

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/annotations.webp" alt="A YAML block with two numbered markers. The mouse cursor clicks each marker. The first note opens out of its marker, beside the line, and the second opens under its marker.">

[Annotations documentation](https://ewels.github.io/starlight-codeblocks/features/annotations/)

</details>

<details>
<summary>Side annotations</summary>

Show the notes of an annotated block in a column beside the code, so readers see every note next to its line.

````md
```py annotations="side"
```
````

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/side-annotations.png" alt="A Python block with its notes in a column beside the code, each note next to its line.">

[Side annotations documentation](https://ewels.github.io/starlight-codeblocks/features/side-annotations/)

</details>

<details>
<summary>Footnotes</summary>

Add numbered badges to lines, with the notes in a list under the block, where readers see them all at once.

```py
# [!ref] Creates the application object.
app = Flask(__name__)
```

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/footnotes.webp" alt="A Python block with numbered badges on two lines and the notes in a list under the block. Clicking a badge highlights its line and its note.">

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
<summary>Scrollycoding</summary>

Explain a code block in prose steps that scroll past it, while the block stays in view and focuses the lines of each step.

````mdx
import { Scrollycoding, Step } from 'starlight-codeblocks/components';

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

<details>
<summary>Code walkthrough</summary>

Step through versions of one code block, and watch the code move from each version to the next, so readers see what changed.

````mdx
import { CodeWalkthrough } from 'starlight-codeblocks/components';

<CodeWalkthrough>

```js step="Create the app"
```

```js step="Parse JSON bodies"
```

</CodeWalkthrough>
````

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/code-walkthrough.webp" alt="A JavaScript block with step buttons. Clicking Next moves the code to the next version, and the new lines fade in.">

[Code walkthrough documentation](https://ewels.github.io/starlight-codeblocks/features/code-walkthrough/)

</details>

### Draw attention

<details>
<summary>Focus</summary>

Blur the lines outside a range, so that readers look at the lines that you name first. Every line becomes sharp when a reader hovers over the block or moves keyboard focus into it.

````md
```js focus={4-7}
```
````

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/focus.webp" alt="A code block with four sharp lines and the other lines blurred. The mouse cursor moves over the block and every line becomes sharp.">

[Focus documentation](https://ewels.github.io/starlight-codeblocks/features/focus/)

</details>

<details>
<summary>Line states</summary>

Tint lines as errors, warnings, notes or successes, with an optional message after the code, like the diagnostics in a code editor.

```py
for name in sys.argv[1:]  # [!code error] SyntaxError: expected ':'
```

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/line-states.png" alt="A Python block with a red error line and a yellow warning line, each with its message after the code, and a blue info line.">

[Line states documentation](https://ewels.github.io/starlight-codeblocks/features/line-states/)

</details>

<details>
<summary>Code mentions</summary>

Link a phrase in the prose to lines of the code block below it, so that readers see which lines the text is about.

````md
The [base case](#mention:base) stops the recursion.

```py
    if n == 0:  # [!mention base]
```
````

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/code-mentions.webp" alt="A paragraph with two linked phrases above a Python block. The mouse cursor moves over each phrase and the lines it names stay sharp while the others fade.">

[Code mentions documentation](https://ewels.github.io/starlight-codeblocks/features/code-mentions/)

</details>

### Make code easier to read

<details>
<summary>Hidden lines</summary>

Hide the imports and set-up that readers need to run an example but not to understand it. The copy button still copies every line.

````md
```py hidden={1-3,6-7}
```
````

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/hidden-lines.webp" alt="A Python block with dashed lines in place of hidden lines. Clicking a dashed line shows the hidden imports.">

[Hidden lines documentation](https://ewels.github.io/starlight-codeblocks/features/hidden-lines/)

</details>

<details>
<summary>Expandable blocks</summary>

Show the first lines of a long block, with a fade and a button to reveal the rest.

````md
```py expandable={8}
```
````

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/expandable-blocks.webp" alt="A Python block that shows its first lines with a fade and a button. Clicking the button shows every line.">

[Expandable blocks documentation](https://ewels.github.io/starlight-codeblocks/features/expandable-blocks/)

</details>

<details>
<summary>Visible whitespace</summary>

Show spaces and tabs as faint glyphs, for the blocks where indentation changes the meaning of the code.

````md
```make whitespace
```
````

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/visible-whitespace.png" alt="A Makefile block with a faint arrow for each tab and a faint dot for each leading space.">

[Visible whitespace documentation](https://ewels.github.io/starlight-codeblocks/features/visible-whitespace/)

</details>

<details>
<summary>Colourised brackets</summary>

Colour matching brackets by nesting depth, so readers can match the pairs on a dense line of code.

````md
```js brackets
```
````

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/colourised-brackets.png" alt="Four lines of JavaScript. The nested brackets of the call that starts on the second line have a different colour for each depth.">

[Colourised brackets documentation](https://ewels.github.io/starlight-codeblocks/features/colourised-brackets/)

</details>

<details>
<summary>Colour swatches</summary>

Show a small swatch of each CSS colour next to its value. Readers can click a colour to copy it. Swatches start on their own.

````md
```css
.button { background: rebeccapurple; }
```
````

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/colour-swatches.png" alt="A CSS block. A small square in each colour comes before the values #ffffff, rebeccapurple and a semi-transparent rgb() colour.">

[Colour swatches documentation](https://ewels.github.io/starlight-codeblocks/features/colour-swatches/)

</details>

<details>
<summary>File icons</summary>

Show the icon of the file type before the title of a code block. The icons come from vscode-icons by default, another coloured icon set, or the Starlight file tree. File icons start on their own.

````md
```json title="package.json"
{ "name": "my-site" }
```
````

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/file-icons.png" alt="Four code blocks, each with a file icon from a different icon set before its title: src/index.js, app.py, package.json and Dockerfile.">

[File icons documentation](https://ewels.github.io/starlight-codeblocks/features/file-icons/)

</details>

<details>
<summary>Inline code highlighting</summary>

Give inline code in the prose the syntax colours of the code blocks, from a language suffix or a default language for the site.

```md
> - In JavaScript, `[] + {}{:js}` is `"[object Object]"{:js}`.
```

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/inline-code-highlighting.png" alt="A quoted list of four facts, with inline code in JavaScript, Python, CSS and shell syntax colours.">

[Inline code highlighting documentation](https://ewels.github.io/starlight-codeblocks/features/inline-code-highlighting/)

</details>

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

### Link code

<details>
<summary>Code links</summary>

Turn text in code into a link with a card that describes it, from a directive in the comment above.

```py
# [!link /linspace/ https://numpy.org/doc/stable/reference/generated/numpy.linspace.html] Returns evenly spaced numbers over an interval.
x = np.linspace(0, 1, 50)
```

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/code-links.webp" alt="A Python block where the word linspace is a link with a solid underline in the accent colour. The mouse cursor moves over it and a card shows the description and numpy.org.">

[Code links documentation](https://ewels.github.io/starlight-codeblocks/features/code-links/)

</details>

<details>
<summary>API auto-linking</summary>

Link the names in code examples to their reference pages, with a card that shows the signature and a summary. Adapters for Python and Nextflow come with the plugin.

```py
import json
from pathlib import Path

run = json.loads(Path("run.json").read_text())
```

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/api-auto-linking.webp" alt="A Python block where library names have dotted underlines. The mouse cursor moves over one and a card shows its signature and a summary.">

[API auto-linking documentation](https://ewels.github.io/starlight-codeblocks/features/api-auto-linking/)

</details>

<details>
<summary>Line permalinks</summary>

Give a code block line numbers that link to each line, so readers can share a link to the exact lines they mean. Shift-click to select multiple lines.

````md
```yaml id="cfg"
```
````

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/line-permalinks.webp" alt="A YAML block with line numbers. Clicking a number highlights the line, and a Shift-click extends it to a range.">

[Line permalinks documentation](https://ewels.github.io/starlight-codeblocks/features/line-permalinks/)

</details>

### Adapt to the reader

<details>
<summary>Code tabs</summary>

Show several code blocks as one, with editor tabs in the title bar. Use it for the files of a project, or the commands for each package manager.

````md
:::code-tabs
```yaml title=".github/workflows/ci.yml"
name: CI
on: push
```
```py title="greet.py"
print("Hello, world!")
```
```js title="greet.js"
console.log('Hello, world!');
```
:::
````

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/code-tabs.webp" alt="A code block with three file tabs in the title bar: a GitHub Actions workflow, a Python file and a JavaScript file. Selecting a tab shows that file.">

[Code tabs documentation](https://ewels.github.io/starlight-codeblocks/features/code-tabs/)

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

Add a Copy commands button to terminal blocks, which copies the commands without the prompts or the output. It applies to every terminal block with a prompt line, and to Python sessions with `>>>` prompts.

```sh
$ uv tool install ruff
Resolved 1 package in 180ms
```

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/smart-shell-copy.webp" alt="A terminal block with prompts and their output. The mouse cursor clicks the Copy commands button in the title bar. A caption below the block then shows the copied text: the commands only, without the prompts or the output.">

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
<summary>Run code</summary>

Add a Run code button that runs the example in the browser and shows the output under the block. Python, JavaScript and TypeScript work with no set-up. Python runs with Pyodide, which loads only when a reader clicks **Run code**, and installs the packages that the code imports.

````md
```py runnable
```
````

<img src="https://raw.githubusercontent.com/ewels/starlight-codeblocks/main/.github/assets/readme/run-code.webp" alt="A Python block with a Run code button. Clicking it shows the output of the program under the block.">

[Run code documentation](https://ewels.github.io/starlight-codeblocks/features/run-code/)

</details>

## Licence

MIT
