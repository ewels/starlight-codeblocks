# Docs writing style

This guide covers every word in the docs site, the README and the package description. It is self-contained: follow it without looking up any other style guide.

The guide combines three sources:

- Simplified Technical English (STE, based on ASD-STE100) is the default for every sentence. It sets word choice, sentence length and the shape of instructions.
- The deslop rules remove the patterns that make text read as machine-written.
- The explanation structure, adapted from an explain-a-change style, sets the order of conceptual pages and their tone: clear, engaging and in classic style.

If two rules conflict, STE wins on word choice and sentence length. The explanation structure wins on the order of a page.

## 1. Readers

The readers are authors of Starlight sites. Assume that they know Markdown, the basics of Starlight and how to edit `astro.config.mjs`. Do not assume that they know how Expressive Code works inside. Many readers do not have English as a first language. STE exists for these readers.

## 2. Voice and spelling

- Write to the reader as "you". Write about the plugin in the third person ("the plugin removes the comment").
- Use the present tense. Use the past tense only in the changelog.
- Use the active voice. If a sentence has no human actor, make the plugin, the feature or the browser the subject.
- Use British English spelling, with -ise endings: colour, behaviour, centre, customise, initialise, licence (noun). Keep code, option names and CSS as they are, for example `color` in CSS.
- Do not use the serial comma unless a sentence is unclear without it.
- Write one to nine as words and 10 or more as numerals. Always use numerals with units, in UI text and in code.

## 3. Simplified Technical English

### Words

- Use one word for one concept, every time. The glossary in section 8 gives the word to use.
- Use each word as one part of speech. "Select" is a verb, so the control is a "menu", not "the select".
- Use the most common, literal meaning of a word. Do not use idioms: "out of the box", "under the hood", "a breeze".
- Prefer a one-word verb to a phrasal verb: "configure", not "set up" as a verb; "remove", not "get rid of". Use "turn on" and "turn off" for options, because readers know them from settings screens, and use them consistently.
- Use "must" for requirements and "can" for options and abilities. Do not use "should", "may" or "might", because readers cannot tell if they are optional.
- Avoid words that end in "-ing" when a simpler form exists: "to highlight the line", not "highlighting the line". Technical names such as "syntax highlighting" and "scrollycoding" are fine.
- Keep noun clusters to three words or fewer. "Code block title bar" is the limit. Break longer clusters with a preposition: "the colour of the bar for error lines", not "error line bar colour".
- Keep articles and small words: "Add the attribute to the fence line", not "Add attribute to fence line".

### Sentences

- Instructions: 20 words or fewer. Descriptions: 25 words or fewer.
- Write one instruction in each sentence. You can join two actions only when the reader does them at the same time.
- Put a condition before the instruction: "If the site has an `ec.config.mjs` file, add the preset there."
- Write one topic in each sentence. If a sentence needs "and" to join two topics, write two sentences.

### Paragraphs

- A paragraph has one topic and six sentences or fewer.
- The first sentence says what the paragraph is about.
- Use a list when a paragraph would contain three or more parallel items.

### Procedures

- Use a numbered list for steps that the reader must do in order.
- Start each step with a verb in the imperative: "Add", "Open", "Select".
- Write one action in each step. Put the result, if the reader needs it, in a second sentence in the same step.
- Put a caution before the step that it applies to, not after.

### Cautions

- Use Starlight's `caution` aside when the reader can get wrong output. Use `danger` only for a risk to data or security, such as secrets saved in the browser.
- Start the aside with the instruction, then give the reason: "Do not put real API keys in examples. Readers copy them."

## 4. Page structure

Conceptual pages, including every feature page, follow this order. `DOCS-SITE.md` has the page template.

### Background first

Start from what the reader already knows: a normal code block in Starlight. Then give the narrow background that the feature needs, in one or two short paragraphs. If a page needs background that experienced readers do not need, put it in its own section called "Background", so they can skip it.

### Intuition before detail

Show one small, concrete example near the top, with realistic but small data, in the `Example` component. Explain the essence of the feature in two or three sentences next to it. The reader must understand what the feature does before they read any syntax.

### Detail after

Then give the syntax, the options and the behaviour, in the order an author meets them: what to write, what the reader sees, how to change it, and what to watch for.

### Transitions

Connect sections through their content. The first sentence of a section links to the section before it by its subject. Do not announce structure: no "In this section", no "Now let's look at", no "As we saw above".

### Tone

Write in classic style. You show the reader something true that you can both see, as in a clear technical book. Be confident and concrete. Explain why a feature works the way it does when that helps the reader use it. Do not hedge, and do not sell.

### Figures

Use a small number of figure types, and reuse them on every page:

- The `Example` component: the source an author writes, and the result a reader sees.
- Tables, for syntax and option reference.
- If a page needs a diagram, a simple HTML and CSS figure. Never an ASCII diagram. Never an image of code.

### Asides

Use Starlight asides for a key concept or definition (`note`), an optional shortcut (`tip`), a risk of wrong output (`caution`) or a risk to data or security (`danger`). Use two asides or fewer on a page. Never put two asides next to each other.

### Not on these pages

No quizzes, no questions to the reader, no "Summary" or "Conclusion" sections, and no "Next steps" lists that repeat the sidebar.

## 5. Patterns to remove

These patterns make text read as machine-written. Remove every one.

### Phrases

- Throat-clearing: "Here's the thing", "Here's what/why/how", "It turns out", "The truth is", "Let me be clear".
- Emphasis crutches: "Full stop.", "Let that sink in.", "Make no mistake", "This matters because".
- Hand-holding: "Let's dive in", "Let's break this down", "Let's explore", "Think of it as", "Imagine".
- Filler: "It's worth noting", "Note that", "Notably", "At its core", "When it comes to", "In order to", "Please".
- Meta-commentary: "In this section", "As we'll see", "The rest of this page", "In conclusion", "To sum up", "In summary".
- The "serves as" dodge: write "is". The same for "stands as", "acts as" and "represents" when they mean "is".
- Vague declaratives: "This is important", "The benefits are significant". Name the specific thing.
- Vague attributions: "Many users find". Name the source or remove the claim.

### Structures

- Binary contrasts: "It's not X, it's Y" and "Not X. Y." State Y.
- Negative lists: "Not A. Not B. Just C." State C.
- Rhetorical questions that you answer at once: "The result? Faster pages." Make the statement.
- Fragments stacked for drama: "Fast. Simple. Done." Write full sentences.
- Three items used by habit. Two items or one are often stronger. Use three when there are three.
- The same sentence opening three times in a row.
- False agency: an object that does a human action, such as "the page tells a story". Name the actor.
- Participle tails: ", highlighting its importance", ", making it easy to". Make a real claim or cut it.
- Sentences that start with What, When, Where, Why or How as a crutch: "What makes this useful is…". Lead with the subject.
- Fractal summaries: saying what you will say, saying it, then saying what you said.
- The same point made several times in different words. Make it once.
- Invented labels that sound like established terms, such as "the copy paradox".
- Paragraphs that all end on a short, punchy line.

### Formatting

- No em dashes or en dashes as punctuation. Use a full stop, a comma, a colon or brackets. Write number ranges as "lines 5 to 7".
- No list items that start with a bold word or phrase.
- No arrow characters in prose.
- No emoji.
- Straight quotes in Markdown source. Sätteri's smart punctuation renders curly quotes.
- No question headings.

### Words

Do not use these words in prose. Some are fine in code.

```
simply, just, easy, easily, straightforward, obviously, of course, clearly,
basically, actually, really, very, quite, extremely, truly, genuinely,
powerful, seamless, seamlessly, effortless, effortlessly, robust, blazing,
magic, magical, supercharge, unlock, unleash, elevate, empower, delve,
leverage, utilise, utilize, harness, landscape, ecosystem, tapestry,
game-changer, cutting-edge, best-in-class, next-level, world-class,
crucial, crucially, vital, essential (as praise), key (as an adjective),
quietly, notably, importantly, interestingly, arguably, fundamentally,
various, numerous, a number of, a variety of, etc., and more, and so on
```

Adverbs that end in "-ly" are almost always removable. Remove them unless the sentence changes meaning without them.

## 6. Markdown conventions

- Headings are in sentence case. Use headings up to level 3 on feature pages.
- Headings are nouns ("Options", "Syntax") or imperatives ("Add a custom state").
- Format attribute names, directives, option names, file names, commands and values as code: `focus={4-7}`, `[!code error]`, `ec.config.mjs`.
- Write UI labels exactly as they appear, in bold: select **Copy commands**.
- Use "select" for choosing a control. It works for mice, touch screens and keyboards. Use "hover over" and "focus" only when the difference matters, and then mention both.
- Link text says where the link goes: "see the [options reference](…)", never "click here".
- Use a table for reference data with two or more columns. Use a list for anything else with three or more items.

## 7. Examples

- Every example is realistic and short: 15 lines or fewer, unless the feature needs length (expandable blocks, scrollycoding, sticky footnotes).
- Use `example.com` and `example.org` for domains, and plausible names for files, functions and values. Do not use `foo`, `bar` or `lorem ipsum`.
- Examples must run, or be clearly part of a larger file through the title or hidden lines.
- Comments in examples use British English and follow this guide.
- Never put anything that looks like a real secret in an example. Use `YOUR_TOKEN` and similar names.

## 8. Glossary

Use these words, and only these words, for these concepts.

| Use | For | Do not use |
|---|---|---|
| author | a person who writes pages on a site | writer, user, developer |
| reader | a person who visits the site | user, visitor, viewer |
| site | a Starlight site | project (unless you mean the repository) |
| code block | a fenced block of code | snippet, listing, code fence, code sample |
| fence line | the opening line of a code block | meta, meta string, info string |
| attribute | a `key=value` item or flag on the fence line | meta option, prop, parameter |
| directive | a marker in a comment, such as `[!code focus]` | magic comment, notation, annotation |
| comment notation | the system of directives | magic comments |
| title bar | the top bar of a code block | header, frame header, toolbar |
| copy button | the button that copies the code | copy icon |
| range | a set of line numbers, such as `{1, 4-6}` | selection, span |
| focused line | a line inside a focus range | active line, highlighted line |
| line state | error, warning, info or a custom state | severity, status |
| message | the text after a line state directive | label, diagnostic |
| annotation | a numbered popover note | tooltip, comment |
| callout | a bubble above a line | tooltip, balloon |
| footnote | a numbered note listed under the block | reference, endnote |
| hidden line | a line that `hidden` or `[!code hide]` hides | collapsed line, folded line |
| marker | the dashed line that shows hidden lines | separator, placeholder |
| placeholder field | an input that replaces a placeholder | input, variable |
| variant | one of the code blocks in a code switcher | tab, option |
| step | one version in token transitions or scrollycoding | slide, stage, frame |
| adapter | code that resolves names for API auto-linking | plugin, resolver |
| playground | an external site that runs code | sandbox (unless it is the site's name) |
| runtime | code that runs examples in the browser | engine, interpreter |
| select | choose a control | click, tap, press (for controls) |
| turn on, turn off | change an option | enable, disable, toggle |

## 9. Before and after

Before:

> Focus is a powerful feature that lets you easily draw your readers' attention to the lines that really matter. Simply add the `focus` attribute, and the rest of the code block will be blurred out, making it much easier for readers to follow along!

After:

> Focus blurs every line outside a range, so readers look at the lines you name. Add `focus={4-7}` to the fence line. Readers can hover over the block, or move keyboard focus into it, to see every line clearly.

Changes: removed "powerful", "easily", "really", "Simply" and the participle tail. Split the text into three sentences of 25 words or fewer. Named what the reader does to see the other lines.

Before:

> Callouts vs. annotations — which should you use? It depends! Callouts are great for short notes, while annotations are better for longer ones.

After:

> Use a callout for a note of one short sentence that is about one word or name on a line. Use an annotation when the note is longer, or when the line needs no visual interruption until the reader asks.

Changes: removed the question and the answer that followed it, the em dash and "It depends". Gave the reader a rule they can apply.

Before:

> In order to set up the Nextflow adapter, you'll need to configure the modules option, which serves as a mapping between process names and their documentation pages.

After:

> The Nextflow adapter needs a URL for each module's reference page. Give it a function in the `modules` option:

Changes: removed "In order to", the phrasal verb "set up" and "serves as". Stated the requirement before the code.

Before:

> **Keyboard support**: All controls are fully keyboard accessible.
> **Reduced motion**: Animations are respected.

After:

> - You can use every control with a keyboard. The focus indicator shows which control has focus.
> - When the reader's system asks for reduced motion, steps change without animation.

Changes: removed the bold list leads and the vague "fully" and "respected". Said what happens.

## 10. Checklist

Check every page against this list before you commit it:

- The page starts from what the reader knows, and shows an example before any syntax.
- Every sentence is 25 words or fewer, and every instruction is 20 words or fewer.
- Every paragraph has one topic and six sentences or fewer.
- Every term matches the glossary.
- There is no word from the list in section 5, and no "-ly" adverb that the sentence can lose.
- There are no em dashes, en dashes, arrows, emoji or curly quotes in the source.
- No list item starts with bold text. No heading is a question.
- Every instruction is a numbered step or a single imperative sentence, with conditions first.
- Every example is realistic, short and runs.
- Read the page aloud. If a sentence sounds like an advertisement or a lecture, rewrite it.

## 11. Rules for `pnpm lint:docs`

`scripts/lint-docs.mjs` checks every `.md` and `.mdx` file in `docs/src/content/docs/`, and the README. It ignores code blocks, inline code, front matter, import lines and JSX tags. It reports the file, the line and the rule for each problem, and exits with an error if there is one.

It checks:

- Every word and phrase in the list in section 5, and every phrase in the "Phrases" list, case-insensitive, as whole words.
- Em dashes (U+2014), en dashes (U+2013), arrows (U+2190 to U+21FF), curly quotes (U+2018, U+2019, U+201C, U+201D) and emoji.
- Sentences longer than 25 words. Sentences inside numbered list items longer than 20 words.
- Paragraphs with more than six sentences.
- List items that start with bold text.
- Headings that end with a question mark, or that are not in sentence case. Allow proper nouns and code in headings with a list in the script.
- American spellings: color, behavior, center, customize, organize, initialize, analyze, favorite, gray, license (as a noun), and their other forms.
- The words "should", "may", "might", "click" and "tap".

The script can have an allow-list for real exceptions, with a comment for each entry that says why.
