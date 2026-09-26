# Docs site

The docs site lives in `docs/`. It is a Starlight site that uses the plugin through `workspace:*`, so every example on the site is a live test of the plugin. Every word on it follows `WRITING-STYLE.md`.

## Set-up

- Starlight with Sätteri, no remark or rehype plugins.
- The plugin, with every feature on.
- `starlight-links-validator`, with the plugin's `linksValidatorExclude` function, which ignores `#mention:` links and line permalinks.
- Pagefind search (Starlight's default).
- Deploy to GitHub Pages from CI on pushes to `main` only. Write the workflow, but it does not run during the initial build, because the build never pushes to `main`.

## Sidebar

The feature groups say what authors use the features for, not how the features work. Each group has two to five pages. Comment notation is syntax that many features use, so it is in "Start here". `docs/src/sidebar.mjs` is the source; the README, `llms.txt`, the accessibility page and the home page follow its groups and order.

```
Start here
  Introduction                 (index, splash template)
  Getting started
  Configuration
  Comment notation
Guides
  Choose an annotation style
  Code switcher or tabs
  Migrate from VitePress
  Use with other plugins
Explain code
  Annotations
  Footnotes
  Inline callouts
  Side-by-side annotations
  Scrollycoding
Draw attention
  Focus
  Line states
  Code mentions
Show what changed
  Word-level diff
  Token transitions
Shorten long code
  Hidden lines
  Expandable blocks
Make code easier to read
  Visible whitespace
  Colourised brackets
  Inline code highlighting
Link code
  Token links
  API auto-linking
  Line permalinks
Adapt to the reader
  Code switcher
  Fill-in placeholders
Copy and run
  Smart shell copy
  Open in playground
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
- A feature carousel (`docs/src/components/FeatureCarousel.astro` and `Feature.astro`): one slide for each feature with its name, the first sentence of its page description, one live example that shows only that feature, and a link to its page under the example. Under the slides, a button with an icon for each feature, under a small heading for each sidebar group, in sidebar order. The build fails if a feature in the sidebar has no slide or no icon, or if the slides are out of order.
- The carousel changes slide every 7 seconds. It has a Pause and Play control, and it pauses while the pointer is over it or focus is in it. Selecting a feature stops the rotation. Under reduced motion it does not rotate or fade. Without JavaScript it shows the first slide, and the buttons are links to the feature pages.
- The install command in a code switcher (npm, pnpm, Yarn) and the one line of configuration.
- Links to the Extend and Reference groups.

## Feature page template

Every feature page uses this structure and these headings. Leave out a section only if it would be empty.

Every example on a feature page shows only that page's own feature. No example may trigger another feature by accident, such as word-level diff appearing in a comment notation example, or a line state appearing in a visible whitespace example. If a feature triggers automatically, pick different example code or turn it off for that block (for example `wordDiff=false`). Combining features is allowed only in an example whose explicit purpose is to show a combination, and the text next to it must say so.

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
- Use with other plugins: the plugins that were tested with this one, the order of plugins, and the set-up for plugins that need one (links validator, llms.txt, page actions, versions, Markdoc, `unified()`).

## Extend pages

Each page defines the interface, gives a complete working example that the docs site uses itself, and lists the rules the implementation must follow (for example, "return `null` when you are not certain").

## Reference pages

Generate the options, attributes and directives tables from the source code or from one shared data file, so that they cannot drift from the implementation. The style settings page lists every setting with its dark and light defaults.

## Accessibility page

List what each interactive feature does for keyboard users, screen reader users and readers who ask for reduced motion. Give the contrast targets that the default styles meet.
