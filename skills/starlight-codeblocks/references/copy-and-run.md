# Copy and run

Three features help readers use the code outside the page.

- If a block shows a terminal session with prompts and output, write the prompts. Smart shell copy starts on its own.
- If the language has an online playground, add a playground button.
- If the code is Python, JavaScript or TypeScript, or a language with a runtime on the site, add a **Run code** button. For code that cannot run in the browser, a **Run code** button can print output that you write.

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

## Run code

Docs: https://ewels.github.io/starlight-codeblocks/features/run-code/

Use for short Python, JavaScript or TypeScript examples that readers can run in the page. A **Run code** button under the block runs the code in the browser and shows the output above the button. Python runs with Pyodide, which loads only when a reader clicks **Run code**. The Python runtime has no standard input, so `input()` fails.

| Syntax | Where |
|---|---|
| `runnable` | Code block fence line |
| `runnable.packages="<name> <name>"` | Code block fence line |
| `runnable.args="<arguments>"` | Code block fence line |
| `runnable.button="below"`, `runnable.button="title"`, `runnable.button="both"` | Code block fence line |
| `[!run]`, `[!run lang=<language>]`, `[!run end]` | Comment in the code, on its own line |
| `[!output]`, `[!output stdout]`, `[!output stderr]`, `[!output end]`, with `lang=<language>` after the stream | Comment in the code, on its own line |
| `[!wait <ms>]` | Comment at the end of a line of output |
| `[!code highlight]`, `[!code error]`, `[!code warning]`, `[!code info]`, `[!code success]` | Comment at the end of a line of output |
| `runnable.output="<text>"`, `runnable.outputDelay=<ms>` | Code block fence line |
| `runnable.outputFile="<path>"` | Code block fence line |
| `runnable.outputLang=<language>` | Code block fence line |
| `runnable.static` | Code block fence line |

````md
```py runnable
from statistics import mean
print(mean([1520, 1610, 1480]))
```
````

- The language of the block chooses the runtime. Built in: Python (`py`, `python`, `pycon`), JavaScript (`js`, `javascript`, `mjs`, `cjs`) and TypeScript (`ts`, `typescript`, `mts`, `cts`). TypeScript runs after Sucrase removes the types, and no types are checked. Other languages, and `jsx` or `tsx`, need a site runtime in `runnable.runtimes`. Sites without `codeblocks()` must add a runtime URL for each language.
- JavaScript and TypeScript: `console.log` and `console.info` go to standard output, `console.error` and `console.warn` to standard error. Top-level `await` works; `import` statements do not.
- Standard output and standard error show in the output panel. A run stops after the timeout. The download of the runtime and of imported packages does not count towards the timeout.
- A Python session with `>>>` prompts runs its commands only, as in the Python REPL: the output shows the value of each expression.
- `runnable.button` puts the button under the block (default), in the title bar, or both.
- For code that cannot run in the browser, such as a command line tool, write its output after an `[!output]` comment. The button prints it instead of running the code, one line every `outputDelay` ms (default `200`; `0` prints it at once). The output lines leave the code and the copied text. `[!output end]` ends the output; without it, the output goes to the next `[!run]` line or the end of the block. `[!output stderr]` starts lines that print as standard error, as for a failed run, and `[!output stdout]` switches back. Each switch starts a new part of the output. `[!wait <ms>]` at the end of an output line changes the wait after it. `[!code highlight]` and line state directives at the end of an output line mark it in the output, as in the code. They need line states on. `[!wait]` and a mark can share one comment. Ranges on the fence line, such as `{2}`, count the code lines only. The block needs no `runnable` attribute and no runtime. A block with only output shows the button in the middle of the empty code area. `runnable.output="…"` on the fence line does the same, with `\n` for new lines. `runnable.outputFile="<path>"` reads the output from a file at build time, such as the saved output of a real run. The path is relative to the page. The block shows the output from the start, as with `runnable.static`; add `runnable` for the button. A `.ansi` file is in the `ansi` language unless the block sets `runnable.outputLang`. The file is the whole output: directives in it stay as text. Output on the fence line replaces `[!output]` lines. A missing file gives a build warning. In `astro dev`, a change to the file reloads the page. In the `<Code>` component, the path is relative to the project root.
- To colour scripted output, add `runnable.outputLang=ansi` to the fence line, and write the output with its terminal colour codes. `\e[`, `\x1b[`, `\033[` and `\u001b[` stand for the escape character, and `\\e[` shows the text `\e[`. On the fence line, double each backslash again. A file from `runnable.outputFile` holds the escape character itself, so `\e[` in it stays as text. Other languages, such as `json`, highlight as code. `lang=<language>` on an `[!output]` line sets the language of the lines after it, such as `[!output stderr lang=txt]` for a plain error. `txt` keeps the stream colours. The plugin corrects each colour to 4.5:1 in each theme. With `ansi`, the output of a real run shows its colours too. The Python runtime sets `FORCE_COLOR=1` for these runs, so Rich and similar libraries print colours with no change to the code.
- `runnable.static` shows the scripted output from the start, with no button and no JavaScript: a terminal screenshot as text. It needs scripted output.
- To show one command and run other code, put the code after a `[!run]` comment, with `lang=<language>` for its runtime. The lines leave the block, up to `[!run end]`, the next `[!output]` line or the end. The copy button copies the visible code. Example: a `sh` block with `python greet.py`, then `# [!run lang=python]` and the Python that prints the same output.

````md
```sh
nextflow run hello.nf
# [!output]
Launching hello.nf # [!wait 1500]
Hello world!
# [!output stderr]
ERROR ~ Error executing process > 'sayHello' # [!code error]
```
````
- Python packages: the runtime reads the `import` lines and installs Pyodide's packages (NumPy, pandas and about 350 more). It installs any other import from PyPI with micropip, under the import name. PyPI reads `_`, `-` and `.` as the same character and ignores case, so `import rich_click` installs `rich-click`. PyPI packages must be pure Python. When the package name differs from the import name, name it: ` ```py runnable runnable.packages="python-slugify" ` for `import slugify`. Separate several names with spaces; `name==1.2` pins a version.
- Command line tools: `runnable.args="--count 2 'Ada Lovelace'"` gives the code its arguments, split as a shell splits them. In Python, `sys.argv` is the block title (else `main.py`) and the arguments. Write the tool as in a real file, with `if __name__ == "__main__": main()`. Set `title="hello.py"` for the program name in the usage line. Do not add `standalone_mode=False` or `prog_name` to Click or Typer calls. `sys.exit()` ends the run with no traceback. `COLUMNS` is the panel width, so argparse and Rich help fits the panel; Click help is at least 50 characters wide. One block runs one command line; use one block for each. Typer help needs `runnable.packages="markdown-it-py pygments"`.
- Options: `runnable.timeout` (default `10000` ms), `runnable.button` and `runnable.outputDelay` set the defaults for blocks. `runnable.outputLabel: true` shows an **Output** label above the output. `runnable.runtimes` is a map of language to a runtime module (a package path or a path from the project root). To wrap or replace a built-in runtime, import it from `starlight-codeblocks/runtimes/pyodide`, `/javascript` or `/typescript`. Guide: https://ewels.github.io/starlight-codeblocks/extend/add-a-runtime/
- Limits: Pyodide loads from the jsDelivr CDN and packages from PyPI. Every runtime runs its worker from a `blob:` URL. A Content Security Policy must allow all three. Without JavaScript, the button is hidden.
