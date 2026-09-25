# Changelog

## Unreleased

The first version of the plugin. It added these features to the code blocks of Starlight, on top of Expressive Code:

- Comment notation: `[!code …]` directives in code comments, compatible with VitePress.
- Focus: blurred or dimmed lines outside a range.
- Line states: error, warning, info and custom states, with optional messages.
- Inline callouts: a bubble that points at a word on a line.
- Annotations: numbered popover notes.
- Footnotes: numbered notes under the block, with an optional sticky list.
- Side-by-side annotations: notes in a column next to the code.
- Hidden lines: lines that readers can show, and that the copy button still copies.
- Smart shell copy: the copy button copies the commands without prompts or output.
- Word-level diff: a highlight on the words that changed between a removed line and an added line.
- Visible whitespace: glyphs for spaces and tabs.
- Colourised brackets: bracket colours by nesting depth.
- Token links: links on words in the code.
- API auto-linking: links and hover cards for API names, with adapters for Python and Nextflow.
- Expandable blocks: long blocks that show the first lines until the reader expands them.
- Open in playground: a button that opens the code in the TypeScript Playground, the Rust Playground or a custom playground.
- Code mentions: links in the prose that highlight lines of a block.
- Line permalinks: line numbers that are links to a line or a range.
- Fill-in placeholders: fields in the code that readers fill in, kept across pages.
- Code switcher: several variants of a block, with a menu in the title bar.
- Token transitions: steps of a block, with animated changes between them.
- Scrollycoding: prose steps next to a sticky block that changes with each step.
- Inline code highlighting: syntax colours for inline code with a `{:lang}` suffix.
- Run in the browser: a Run button with an output panel, with a Pyodide runtime for Python.
