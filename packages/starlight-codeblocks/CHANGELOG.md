# Changelog

## 1.5.0

- Split diff: new feature, a switch between unified and side-by-side views of a diff ([#37](https://github.com/ewels/starlight-codeblocks/pull/37))
- Skipped code: new feature, `[!code skip]` and `// ...` show a marker for left-out code ([#39](https://github.com/ewels/starlight-codeblocks/pull/39))
- Options: `only` turns on just the listed features ([#38](https://github.com/ewels/starlight-codeblocks/pull/38))
- Expressive Code plugins: listed plugins replace the ones `codeblocks()` adds ([#38](https://github.com/ewels/starlight-codeblocks/pull/38))
- Markdown plugins: exported from `starlight-codeblocks/markdown` ([#38](https://github.com/ewels/starlight-codeblocks/pull/38))
- Run code: `runnable.args` passes command line arguments, read by `sys.argv` in Python ([#43](https://github.com/ewels/starlight-codeblocks/pull/43))
- Run code: `sys.exit()` in Python ends a run with no traceback ([#43](https://github.com/ewels/starlight-codeblocks/pull/43))
- Run code: `COLUMNS` matches the width of the output panel ([#43](https://github.com/ewels/starlight-codeblocks/pull/43))
- Run code: `FORCE_COLOR` is set for Python runs with `runnable.outputLang=ansi` ([#47](https://github.com/ewels/starlight-codeblocks/pull/47))
- Code tabs: the block no longer moves when the tab changes ([#45](https://github.com/ewels/starlight-codeblocks/pull/45))
- Title bar: untitled blocks with controls use the tab bar colours ([#37](https://github.com/ewels/starlight-codeblocks/pull/37))
- API links: a stale starlight-pydocs registry is dropped after a dev restart ([#44](https://github.com/ewels/starlight-codeblocks/pull/44))

## 1.4.1

- Run code: `runnable.outputFile` reads scripted output from a file ([#35](https://github.com/ewels/starlight-codeblocks/pull/35))
- Run code: `runnable.static` warns when the block has no output ([#35](https://github.com/ewels/starlight-codeblocks/pull/35))
- Run code: `\\e[` in `ansi` output shows as text ([#35](https://github.com/ewels/starlight-codeblocks/pull/35))

## 1.4.0

- Run code: `runnable.outputLang` and `[!output lang=…]` highlight scripted output, and `ansi` shows terminal colours ([#32](https://github.com/ewels/starlight-codeblocks/pull/32))
- Run code: `runnable.static` shows scripted output with no button and no JavaScript ([#32](https://github.com/ewels/starlight-codeblocks/pull/32))
- Run code: `[!run]` runs hidden code in place of the code that readers see ([#32](https://github.com/ewels/starlight-codeblocks/pull/32))
- Run code: long output lines scroll in place of wrapping, and new style settings set the output font ([#32](https://github.com/ewels/starlight-codeblocks/pull/32))
- Run code: the **Output** label is for screen readers only, unless `outputLabel` is set ([#32](https://github.com/ewels/starlight-codeblocks/pull/32))

## 1.3.0

- API links: the Nextflow adapter links directives, labels, globals and config scopes ([#22](https://github.com/ewels/starlight-codeblocks/pull/22))
- Code walkthrough: `start` opens on a chosen step ([#23](https://github.com/ewels/starlight-codeblocks/pull/23))
- Run code: `[!output stderr]`, and line marks on lines of output ([#24](https://github.com/ewels/starlight-codeblocks/pull/24))
- Run code: ranges on the fence line count lines of code only ([#24](https://github.com/ewels/starlight-codeblocks/pull/24))
- Translations: plugin texts in 17 languages, as Starlight UI strings ([#25](https://github.com/ewels/starlight-codeblocks/pull/25))

## 1.2.0

- Squiggles: wavy error, warning and info lines under code, with a message on hover, focus or tap ([#16](https://github.com/ewels/starlight-codeblocks/pull/16))
- Callouts, code links: a `/text/` match prefers a whole word ([#16](https://github.com/ewels/starlight-codeblocks/pull/16))

## 1.1.0

- Astro: `starlight-codeblocks/astro` adds every feature to Astro sites without Starlight ([#14](https://github.com/ewels/starlight-codeblocks/pull/14))
- Docs: an example Astro site, and separate install pages for Starlight and Astro ([#14](https://github.com/ewels/starlight-codeblocks/pull/14))
- Integration: a change to the options clears cached Markdown pages ([#13](https://github.com/ewels/starlight-codeblocks/pull/13))

## 1.0.1

- Swatches: `match` and `delimiters` options ([#6](https://github.com/ewels/starlight-codeblocks/pull/6))
- File icons: `false` turns icons off ([#8](https://github.com/ewels/starlight-codeblocks/pull/8))
- Callouts: bubble text is selectable ([#11](https://github.com/ewels/starlight-codeblocks/pull/11))
- Notation: warn on directives outside comments ([#5](https://github.com/ewels/starlight-codeblocks/pull/5))
- Annotations: notes open beside more markers ([#12](https://github.com/ewels/starlight-codeblocks/pull/12))
- Footnotes: text exports drop the numbers ([#3](https://github.com/ewels/starlight-codeblocks/pull/3))

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
