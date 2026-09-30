# Docs writing style

Applies to `docs/`, the README, `skills/` and package descriptions. The base is Simplified Technical English (ASD-STE100): one meaning per word, short sentences, active voice. `pnpm lint:docs` (`scripts/lint-docs.mjs`) checks the mechanical rules and holds the full lists of banned words and phrases.

Readers are authors of Starlight sites. They know Markdown, Starlight basics and `astro.config.mjs`, not Expressive Code internals. Many do not have English as a first language.

## Rules the linter checks

- Sentences of 25 words or fewer; numbered steps of 20 or fewer. Paragraphs of six sentences or fewer.
- No word or phrase from the lists in the script (hype, filler, meta-commentary such as "In this section").
- No "should", "may", "might" (use "must" or "can"), "click" for using a control, and "select" only for text.
- British spelling with -ise (colour, behaviour, customise, licence as a noun). Code and CSS stay as they are.
- No em or en dashes, arrows, emoji or curly quotes in the source.
- No list item that starts with bold text. Headings in sentence case, never a question.

## Rules you check yourself

- "You" for the reader; the plugin in the third person. Present tense.
- One word for one concept (glossary below). "Turn on" and "turn off" for options.
- Noun clusters of three words or fewer. Keep articles: "Add the attribute to the fence line".
- A condition goes before its instruction. One instruction per sentence.
- No "key" as an adjective, no "essential" as praise, and cut any "-ly" adverb the sentence can lose.
- No binary contrasts ("not X, it's Y"), rhetorical questions, stacked fragments, participle tails (", making it easy to"), or the same point twice.
- One to nine as words, 10 and up as numerals; numerals always with units.
- Code formatting for attributes, directives, options, files, commands and values. UI labels in bold, as they appear: select **Copy commands**.
- Link text says where it goes. Links between pages are absolute, from `/starlight-codeblocks/`.
- At most two asides per page, never adjacent. `caution` for wrong output, `danger` only for data or security.
- No quizzes, "Summary" or "Next steps" sections. No images of code, no ASCII diagrams.

## Examples

- Realistic and short: 15 lines or fewer unless the feature needs length. `example.com`, plausible names, never `foo` or `lorem ipsum`. Examples run, or the title or hidden lines show they are part of a larger file.
- Each example shows only its own feature (see AGENTS.md for `hiddenAttributes`). A combination is allowed only where the text says so.
- Never anything that looks like a real secret. Use `YOUR_TOKEN`.

## Feature page template

Leave out a section only if it would be empty.

```mdx
---
title: <Feature name>
description: <One sentence, 25 words or fewer: what the feature does for readers.>
---

<Two to four sentences: what the reader already has, and what the feature adds.>

<Example> with the smallest example that shows the feature. It is also the home page carousel slide.

<Two or three sentences on what the example shows.>

## Syntax        a "Syntax | Where" table of attributes and directives, with no Example column
## Behaviour     what readers see and do: copied text, keyboard, reduced motion, no JavaScript
## Options       generated with <Options />
## Examples      two to four real uses, one sentence of context each
## Limitations   short list
## Related       other features, one sentence each on when to use them instead
```

Background comes before detail: start from a normal Starlight code block, show the example, then give syntax in the order an author meets it. Sections connect through their content, not through announcements.

## Glossary

| Use | For | Not |
|---|---|---|
| author | a person who writes pages | writer, user, developer |
| reader | a person who visits the site | user, visitor, viewer |
| site | a Starlight site | project (unless the repository) |
| code block | a fenced block of code | snippet, listing, code sample |
| fence line | the opening line of a code block. Jargon: gloss it at its first use on a page, as "the fence line (the first line of the code block, with the language)", and in tables write "Code block fence line" | meta, meta string, info string, a bare "fence line" |
| attribute | a `key=value` item or flag on the fence line | meta option, prop, parameter |
| directive | a marker in a comment, such as `[!code focus]` | magic comment, notation |
| comment notation | the system of directives | magic comments |
| title bar | the top bar of a code block | header, toolbar |
| copy button | the button that copies the code | copy icon |
| range | line numbers such as `{1, 4-6}` | selection, span |
| focused line | a line inside a focus range | active line, highlighted line |
| line state | error, warning, info or a custom state | severity, status |
| message | the text after a line state directive | label, diagnostic |
| annotation | a numbered popover note | tooltip, comment |
| callout | a bubble above a line | tooltip, balloon |
| footnote | a numbered note listed under the block | reference, endnote |
| hidden line | a line that `hidden` or `[!code hide]` hides | collapsed line, folded line |
| marker | the dashed line that shows hidden lines | separator, placeholder |
| placeholder field | an input that replaces a placeholder | input, variable |
| variant | one code block in a code switcher | tab, option |
| step | one version in a code walkthrough, or one prose step in scrollycoding | slide, stage, frame |
| adapter | code that resolves names for API auto-linking | plugin, resolver |
| playground | an external site that runs code | sandbox (unless its name) |
| runtime | code that runs examples in the browser | engine, interpreter |
| click | use a control, with a mouse, a tap or the keyboard | select, press |
| selection | text that a reader highlights to copy | |
| mouse cursor | what a reader moves over a control to hover | pointer |
| turn on, turn off | change an option | enable, disable, toggle |
