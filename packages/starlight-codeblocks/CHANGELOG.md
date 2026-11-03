# Changelog

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
