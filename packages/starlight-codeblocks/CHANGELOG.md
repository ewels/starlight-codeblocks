# Changelog

## Unreleased

- `only` turns on only the features that it lists, and every other feature off: `codeblocks({ only: ['focus', 'codeTabs'] })`. With a feature that reads directives in comments, it also turns on `notation`
- Plugins of the package in `expressiveCode.plugins` take the place of the ones that `codeblocks()` adds, in place of a second copy. The plugins of `codeblocks()` go where the list has the first one, so other plugins can come after them (#36)
- Markdown plugins: `starlight-codeblocks/markdown` exports a Markdown plugin for each feature that changes Markdown, such as `mdastCodeTabs()`, and `mdastCodeblocks()` for all of them. `codeblocks()` adds only the ones that the Markdown processor does not already list, in the correct order among them. A listed plugin for a feature that is off stops the build (#36)
- Split diff: a **Unified** and **Split** switch in the title bar of each block that removes and adds lines. **Split** shows the old code on the left and the new code on the right, as a GitHub pull request does. `splitDiff.view`, `splitDiff.switch` and `splitDiff.sync` set the start view, remove the switch and stop it syncing across the page (#37)
- Untitled blocks with title bar controls use the tab bar colours of titled blocks (#37)
- Skipped code: `[!code skip]` on its own line shows a marker in place of code that a block leaves out, at the indentation of its line. The text after the directive goes in the marker, else it reads "Code not shown". The line keeps its line number, and copies as a comment with the text, such as `// Not shown: Imports`. A comment that holds only `...`, such as `// ...`, and `...` alone on a line in JSON, also show as markers and copy as written. `skippedCode.commentAliases` and `skippedCode.bareAliases` change these aliases for each language. `skippedCode: false` turns the feature off (#28)
- API links: a starlight-pydocs registry left over from an `astro dev` restart that removed starlight-pydocs from the config is dropped, so Python names no longer link to its old pages

## 1.4.1

- Run code: `runnable.outputFile="<path>"` reads scripted output from a file at build time, with the path relative to the page. The block shows it from the start; `runnable` gives it the button. A `.ansi` file is in the `ansi` language. In `astro dev`, a change to the file reloads the page (#35)
- Run code: `runnable.static` with no output gives a build warning in a block without `runnable`. Before, it had no effect and no warning (#35)
- Run code: in `ansi` output, `\\e[` (and the `\\x1b[`, `\\033[` and `\\u001b[` forms) shows the text `\e[`, for output that prints it (#35)

## 1.4.0

- Run code: `runnable.outputLang` and `[!output lang=…]` highlight scripted output in a language. With `ansi`, terminal colour codes show as colours, corrected for contrast in each theme, in scripted output and in the output of real runs (#32)
- Run code: `runnable.static` shows scripted output from the start, with no button and no JavaScript (#32)
- Run code: `[!run]` runs hidden code in place of the code that readers see, so a terminal block can show a command and run Python (#32)
- Run code: the output panel is a shade darker than the code, and long lines of output scroll sideways, as code does, instead of wrapping. The `wrap` attribute wraps them. The `codeblocksRunnable.outputFontFamily` and `outputLineHeight` style settings give the output its own font, such as one with box-drawing characters (#32)
- Run code: the output panel has no visible **Output** label, which screen readers still hear. The `outputLabel` option shows it (#32)

## 1.3.0

- API links: the Nextflow adapter links process directives, input and output labels, global names such as `params`, and the scopes and process directives of config files. `nextflow="config"` marks a block as a config file (#22)
- Code walkthrough: `start` opens a walkthrough on a chosen step, and `walkthrough: { start: 'last' }` sets it for the site (#23)
- Run code: `[!output stderr]` prints scripted output as standard error, and `[!code highlight]` and the line states mark lines of output (#24)
- Run code: ranges on the fence line count lines of code only, not lines of scripted output, so a range after `[!output end]` can now mark another line (#24)
- Translations: the plugin texts are Starlight UI strings, with translations in 17 languages. A site changes them in `src/content/i18n/` (#25)

## 1.2.0

- Squiggles: wavy error, warning and info lines under code, with a message on hover, focus or tap (#16)
- Callouts, code links: a `/text/` match prefers a whole word (#16)

## 1.1.0

- Astro: `starlight-codeblocks/astro` adds every feature to Astro sites without Starlight (#14)
- Docs: an example Astro site, and separate install pages for Starlight and Astro (#14)
- Integration: a change to the options clears cached Markdown pages (#13)

## 1.0.1

- Swatches: `match` and `delimiters` options (#6)
- File icons: `false` turns icons off (#8)
- Callouts: bubble text is selectable (#11)
- Notation: warn on directives outside comments (#5)
- Annotations: notes open beside more markers (#12)
- Footnotes: text exports drop the numbers (#3)

## 1.0.0

The first release. It adds these features to Starlight code blocks, on top of Expressive Code:

- Comment notation
- Focus
- Line states
- Inline callouts
- Annotations
- Footnotes
- Side annotations
- Hidden lines
- Smart shell copy
- Word-level diff
- Visible whitespace
- Colourised brackets
- Colour swatches
- File icons
- Code links
- API auto-linking, with adapters for Python and Nextflow
- Expandable blocks
- Open in playground
- Code mentions
- Line permalinks
- Fill-in placeholders
- Code tabs
- Code walkthrough
- Scrollycoding
- Inline code highlighting
- Run code, with runtimes for Python (Pyodide, with packages from PyPI), JavaScript and TypeScript, and scripted output for code that cannot run in the browser
