# Copy and run

Three features help readers use the code outside the page.

- If a block shows a terminal session with prompts and output, write the prompts. Smart shell copy starts on its own.
- If the language has an online playground, add a playground button.
- If the code is Python, or a language with a runtime on the site, add a **Run in browser** button.

All three use the copied text of the block: directives removed, hidden lines kept and placeholder values filled in. The code must be complete.

## Smart shell copy

Docs: https://ewels.github.io/starlight-codeblocks/features/smart-shell-copy/

Smart shell copy adds a **Copy commands** button to terminal blocks. It copies the commands without the prompts or the output. The normal copy button still copies the whole block. It has no attribute. It applies to every block with a terminal frame and at least one prompt line.

| Block | Terminal frame |
|---|---|
| A shell language, such as `sh`, `bash`, `zsh` or `powershell` | Yes, from the automatic frame of Expressive Code |
| Any language with `frame="terminal"` | Yes |
| A shell language with `frame="code"` or `frame="none"` | No |

```sh
$ uv tool install ruff
Resolved 1 package in 180ms
$ ruff check src/ \
    --fix
```

- A line that starts with a prompt is a command. A command line that ends with `\` continues on the next line.
- Every other line is output, in a muted colour with no syntax colours.
- Option: `shellCopy.prompts` (default `['$ ', '> ']`). `#` is not a default, because it also starts a shell comment. Add `'# '` or `'PS> '` if the site uses them. `shellCopy: false` turns the feature off.
- Limits: a prompt must be the first text on the line.

A `pycon` block with a line that starts with `>>> ` is a Python session. A `python` or `py` block is a session when its first line starts with `>>> `. It keeps its editor frame, and needs no `frame="terminal"`.

```py
>>> from pathlib import Path
>>> for name in ["a", "b"]:
...     print(Path(name).with_suffix(".txt"))
...
a.txt
b.txt
```

- `>>> ` starts a command. `... ` or a bare `...` continues it while the statement is open, as in the Python REPL.
- After a complete statement, a line that starts with `...` is output, such as the text that `print("...")` shows.
- A line that starts with `>>> ` is always a command, also if a command printed it.
- API auto-linking links names in the commands only.

## Open in playground

Docs: https://ewels.github.io/starlight-codeblocks/features/open-in-playground/

Use when an online playground can run the language. A title bar button opens the playground in a new tab, with the code filled in.

| Syntax | Where |
|---|---|
| `playground="<name>"` | Code block fence line |

| Name | Button |
|---|---|
| `typescript` | **Open in TS Playground** |
| `rust` | **Open in Rust Playground** |

- A site adds playgrounds in the `playgrounds` option. Each has a `label` and one of `url` (returns the URL) or `post` (returns a form action and fields):

  ```js
  codeblocks({
    playgrounds: {
      pythontutor: {
        label: 'Open in Python Tutor',
        url: ({ code }) => `https://pythontutor.com/visualize.html#mode=edit&py=3&code=${encodeURIComponent(code)}`,
      },
    },
  });
  ```

- An unknown name gives a build warning and no button. A URL longer than 8,000 characters gives a warning.
- The button works without JavaScript.
- Limits: one playground for each block. Test each custom playground once in a browser. Guide: https://ewels.github.io/starlight-codeblocks/extend/add-a-playground/

## Run in the browser

Docs: https://ewels.github.io/starlight-codeblocks/features/run-in-the-browser/

Use for short Python examples that readers can run in the page. A **Run in browser** button runs the code in the browser and shows the output under the block. Python runs with Pyodide, which loads only when a reader clicks **Run in browser**. The Python runtime has no standard input, so `input()` fails.

| Syntax | Where |
|---|---|
| `runnable` | Code block fence line |

````md
```py runnable
from statistics import mean
print(mean([1520, 1610, 1480]))
```
````

- The language of the block chooses the runtime. `py` and `python` use the built-in Python runtime. Sites without Starlight must add a Python runtime URL to `runnable.runtimes`.
- Standard output and standard error show in the output panel. A run stops after the timeout. The download of the runtime and of imported packages does not count towards the timeout.
- A Python session with `>>>` prompts runs its commands only, as in the Python REPL: the output shows the value of each expression.
- Packages outside the standard library must be part of Pyodide. The runtime installs them from the `import` lines.
- Options: `runnable.timeout` (default `10000` ms) and `runnable.runtimes`, a map of language to a runtime module (a package path or a path from the project root). Guide: https://ewels.github.io/starlight-codeblocks/extend/add-a-runtime/
- Limits: Pyodide loads from the jsDelivr CDN and runs its worker from a `blob:` URL, so a Content Security Policy must allow both. Without JavaScript, the button is hidden.
