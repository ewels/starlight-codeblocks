# Show what changed

Two features show change. Word-level diff marks the changed words inside one block. Token transitions animate one block through several versions.

- If the reader compares one before and one after of a few lines, use a diff in one block. Word-level diff starts on its own.
- If a file grows or changes over the steps of a tutorial, use token transitions.
- If the versions are alternatives, such as package managers, use the code switcher. It has no order.
- If the code stays the same and the prose moves through it, use scrollycoding.

## Word-level diff

Docs: https://ewels.github.io/starlight-codeblocks/features/word-level-diff/

Word-level diff highlights the words that changed inside each pair of removed and added lines, so readers find a one-word edit in a long line. It has no attribute to turn it on. It applies to every removed line that has an added line below it, from any of these sources:

| Source | Where |
|---|---|
| A `diff` block, such as `diff lang="js"` | Fence line. `lang` keeps the syntax colours. |
| `ins={range}`, `del={range}` | Fence line, in a block of any language |
| `[!code ++]`, `[!code --]` | Comment at the end of the line |
| `wordDiff=false` | Fence line: turns the feature off for one block |

````md
```diff lang="js"
-const timeout = 5000;
+const timeout = options.timeout ?? 5000;
```
````

- Prefer `[!code ++]` and `[!code --]` when the block can change, because they move with their line.
- Changed words get a stronger tint. Added words are underlined, and removed words have a line through them.
- A pair that is less than 40% similar keeps the whole-line tints only.
- Needs no JavaScript.
- Option: `wordDiff.minSimilarity` (default `0.4`, from 0 to 1). Raise it to show the highlight only for close edits. `wordDiff: false` turns it off for the site.
- Limits: pairing is by position, so a run of removed lines pairs one by one with the run of added lines below it. It compares visible text and does not parse the language. It skips long pairs, such as minified code.
- Add `wordDiff=false` to a block with `[!code ++]` and `[!code --]` that shows a different feature.

## Token transitions

Docs: https://ewels.github.io/starlight-codeblocks/features/token-transitions/

Use for a tutorial that shows the same file several times, with changes each time. The versions become one block with numbered steps in the title bar, and **Previous** and **Next** buttons under it. Code that stays moves to its new place, and new code fades in. Do not use for alternatives with no order: use the code switcher.

| Syntax | Where |
|---|---|
| `<CodeSteps>` ... `</CodeSteps>` | Around two or more code blocks, in an MDX file |
| `step="<text>"` | Fence line of each step: the label of the step. Optional. |

````mdx
import { CodeSteps } from 'starlight-codeblocks/components';

<CodeSteps>

```js title="server.js" step="Create the app"
const app = express();

app.listen(3000);
```

```js title="server.js" step="Parse JSON bodies"
const app = express();
app.use(express.json());

app.listen(3000);
```

</CodeSteps>
````

- Leave an empty line after `<CodeSteps>` and before `</CodeSteps>`. Each code block is one step, in order. Each keeps its other attributes, such as `title`.
- The copy button copies the code of the current step.
- Arrow keys move between steps when a numbered step has focus. Under reduced motion, steps change without the animation.
- Without JavaScript, and when the page prints, each step shows as a separate block with its label after the title.
- The page loads the animation library, about 3 kB, only on pages with `<CodeSteps>`.
- Option: `transitions: false` shows each step as a separate block, with no script. The `codeblocksTransitions` style settings change the colours and `duration`.
- Limits: MDX only. During the animation, only the syntax colours show. Line states, line numbers and other decorations come back at the end.
