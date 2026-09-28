# Changelog

## Unreleased

The first version of the plugin. It adds these features to the code blocks of Starlight, on top of Expressive Code:

- Comment notation: `[!code …]` directives in code comments, compatible with VitePress.
- Focus: blurred or dimmed lines outside a range.
- Line states: error, warning, info and custom states, with optional messages.
- Inline callouts: a bubble that points at a word on a line. Between two highlighted lines, it keeps the highlight.
- Annotations: numbered popover notes, shown on hover and kept open with a click.
- Footnotes: numbered notes under the block, with an optional sticky list. Hover or select a badge or a note to highlight both.
- Side-by-side annotations: notes in a column next to the code, when the longest line fits. On a page without a table of contents, wide blocks spread past the content column. `codeSide="right"` puts the code on the right.
- Hidden lines: lines that readers can show, and that the copy button still copies.
- Smart shell copy: a Copy commands button in the title bar of terminal blocks, and of Python blocks with `>>>` prompts, copies the commands without prompts or output.
- Word-level diff: a highlight on the words that changed between a removed line and an added line.
- Visible whitespace: glyphs for spaces and tabs.
- Colourised brackets: bracket colours by nesting depth.
- Token links: links on words in the code.
- API auto-linking: links and hover cards for API names, with adapters for Python and Nextflow. The Python adapter links the packages of starlight-pydocs with no configuration, and `pydocsBase` links a block to one version of a package.
- Expandable blocks: long blocks that show the first lines until the reader expands them, for one block or for every block over a line count.
- Open in playground: a button that opens the code in the TypeScript Playground, the Rust Playground or a custom playground.
- Code mentions: links in the prose that highlight lines of a block.
- Line permalinks: line numbers that are links to a line or a range.
- Fill-in placeholders: fields in the code that readers fill in, kept across pages.
- Code switcher: several variants of a block, with a menu in the title bar.
- Code walkthrough: `<CodeWalkthrough>`, steps of a block, with animated changes between them.
- Scrollycoding: prose steps next to a sticky block that changes with each step. A code block between steps animates the block to a new version. The columns get a width from the longest line, spread past the content column on a page without a table of contents, and `codeSide="left"` puts the code on the left.
- Inline code highlighting: syntax colours for inline code with a `{:lang}` suffix, or in a default language for the site.
- Run in the browser: a Run button with an output panel, with a Pyodide runtime for Python.
