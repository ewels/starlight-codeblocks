export const sidebar = [
  {
    label: 'Start here',
    items: [{ label: 'Introduction', link: '/' }, 'getting-started', 'configuration', 'features/comment-notation'],
  },
  {
    label: 'Guides',
    items: [
      'guides/choose-an-annotation-style',
      'guides/code-switcher-or-tabs',
      'guides/migrate-from-vitepress',
      'guides/use-with-other-plugins',
      'guides/use-with-other-themes',
      'guides/kitchen-sink',
      'guides/agent-skill',
    ],
  },
  {
    label: 'Explain code',
    items: [
      'features/annotations',
      'features/footnotes',
      'features/inline-callouts',
      'features/side-by-side-annotations',
      'features/scrollycoding',
      'features/code-walkthrough',
    ],
  },
  {
    label: 'Draw attention',
    items: ['features/focus', 'features/line-states', 'features/code-mentions'],
  },
  {
    label: 'Make code easier to read',
    items: [
      'features/hidden-lines',
      'features/expandable-blocks',
      'features/visible-whitespace',
      'features/colourised-brackets',
      'features/inline-code-highlighting',
      'features/word-level-diff',
    ],
  },
  {
    label: 'Link code',
    items: ['features/code-links', 'features/api-auto-linking', 'features/line-permalinks'],
  },
  {
    label: 'Adapt to the reader',
    items: ['features/code-switcher', 'features/fill-in-placeholders'],
  },
  {
    label: 'Copy and run',
    items: ['features/smart-shell-copy', 'features/open-in-playground', 'features/run-in-the-browser'],
  },
  {
    label: 'Extend',
    items: ['extend/write-an-api-link-adapter', 'extend/add-a-playground', 'extend/add-a-runtime'],
  },
  {
    label: 'Reference',
    items: [
      'reference/options',
      'reference/attributes',
      'reference/directives',
      'reference/style-settings',
      'reference/expressive-code-plugins',
      'reference/accessibility',
    ],
  },
];

/**
 * The feature pages on the home page carousel, by sidebar group. Comment notation is shared syntax, not a feature
 * in its own right, so it gets no slide.
 */
export const carouselGroups = sidebar
  .map(({ label, items }) => ({
    label,
    ids: items.filter(
      /** @returns {item is string} */
      (item) => typeof item === 'string' && item.startsWith('features/') && item !== 'features/comment-notation',
    ),
  }))
  .filter(({ ids }) => ids.length > 0);

/** Pages that the sidebar and `llms.txt` leave out, such as demos that a feature page links to. */
export const unlisted = ['features/side-by-side-annotations/wide', 'features/scrollycoding/wide'];
