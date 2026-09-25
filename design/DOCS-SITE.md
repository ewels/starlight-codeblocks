# Docs site

The docs site lives in `docs/`. It is a Starlight site that uses the plugin through `workspace:*`, so every example on the site is a live test of the plugin. Every word on it follows `WRITING-STYLE.md`.

## Set-up

- Starlight with Sätteri, no remark or rehype plugins.
- The plugin, with every feature on.
- `starlight-links-validator`, configured to ignore `#mention:` links.
- Pagefind search (Starlight's default).
- Deploy to GitHub Pages from CI on pushes to `main` only. Write the workflow, but it does not run during the initial build, because the build never pushes to `main`.

## Sidebar

```
Start here
  Introduction                 (index, splash template)
  Getting started
  Configuration
Guides
  Choose an annotation style
  Code switcher or tabs
  Migrate from VitePress
Inside the code block
  Focus
  Line states
  Comment notation
  Inline callouts
  Annotations
  Footnotes
  Hidden lines
  Smart shell copy
  Word-level diff
  Visible whitespace
  Colourised brackets
  Token links
  API auto-linking
  Expandable blocks
  Open in playground
Across the page
  Code mentions
  Line permalinks
  Fill-in placeholders
  Code switcher
  Token transitions
  Scrollycoding
  Side-by-side annotations
More
  Inline code highlighting
  Run in the browser
Extend
  Write an API link adapter
  Add a playground
  Add a runtime
Reference
  Options
  Attributes
  Directives
  Style settings
  Expressive Code plugins
  Accessibility
```

## The introduction page

- One paragraph that says what the plugin adds to Starlight code blocks.
- One live code block that shows focus and an annotation together, like the hero block in the mockups.
- The install command in a code switcher (npm, pnpm, Yarn) and the one line of configuration.
- A short list of the feature groups, each linked to its first page.

## Feature page template

Every page in the three feature groups uses this structure and these headings. Leave out a section only if it would be empty.

```mdx
---
title: <Feature name>
description: <One sentence, 25 words or fewer, that says what the feature does for readers.>
---

<Opening paragraph: what the reader already has, and what the feature adds. Two to four sentences.>

<Example> with the smallest example that shows the feature.

<Two or three sentences that explain what the example shows.>

## Syntax
<Table of the attributes and directives, with one example each.>

## Behaviour
<What the reader sees and can do. Include the copied text, the keyboard, reduced motion and what happens without JavaScript.>

## Options
<Table: option, type, default, description. Then one configuration example.>

## Examples
<Two to four more examples of real uses, each with one sentence of context.>

## Limitations
<Known limits and edge cases, as a short list.>

## Related
<Links to related features, with one sentence each on when to use them instead.>
```

## The `Example` component

Build an `Example` component for the docs site. It takes the Markdown for one or more code blocks as a string. It shows that source as a code block labelled "You write", and renders it with the plugin under the label "Readers see", as in the mockups.

Use Starlight's `<Code>` component for the rendering if the spike confirms that the plugin works with it. Features that need a directive or a component (code switcher, token transitions, scrollycoding) cannot render through `<Code>`. For those, write the source in a `md` or `mdx` code block, followed by the live version. Add a unit test that checks that the two stay the same.

## Guides

- Choose an annotation style: when to use inline callouts, annotations, footnotes and side-by-side annotations. Give one example of each, with the same code, so readers can compare.
- Code switcher or tabs: when to use the code switcher and when to use Starlight's `<Tabs>`.
- Migrate from VitePress: the VitePress features and their equivalents, the directives that work unchanged, and the ones that differ.

## Extend pages

Each page defines the interface, gives a complete working example that the docs site uses itself, and lists the rules the implementation must follow (for example, "return `null` when you are not certain").

## Reference pages

Generate the options, attributes and directives tables from the source code or from one shared data file, so that they cannot drift from the implementation. The style settings page lists every setting with its dark and light defaults.

## Accessibility page

List what each interactive feature does for keyboard users, screen reader users and readers who ask for reduced motion. Give the contrast targets that the default styles meet.
