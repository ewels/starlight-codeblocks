import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import codeblocks from 'starlight-codeblocks';
import starlightLinksValidator from 'starlight-links-validator';

export default defineConfig({
  site: 'https://ewels.github.io',
  base: '/starlight-codeblocks',
  integrations: [
    starlight({
      title: 'starlight-codeblocks',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/ewels/starlight-codeblocks' }],
      disable404Route: true,
      plugins: [codeblocks(), starlightLinksValidator({ exclude: ({ link }) => link.startsWith('#mention:') })],
      sidebar: [
        {
          label: 'Start here',
          items: [{ label: 'Introduction', link: '/' }, 'getting-started', 'configuration'],
        },
        {
          label: 'Guides',
          items: ['guides/choose-an-annotation-style', 'guides/code-switcher-or-tabs', 'guides/migrate-from-vitepress'],
        },
        {
          label: 'Inside the code block',
          items: [
            'features/focus',
            'features/line-states',
            'features/comment-notation',
            'features/inline-callouts',
            'features/annotations',
            'features/footnotes',
            'features/hidden-lines',
            'features/smart-shell-copy',
            'features/word-level-diff',
            'features/visible-whitespace',
            'features/colourised-brackets',
            'features/token-links',
            'features/api-auto-linking',
            'features/expandable-blocks',
            'features/open-in-playground',
          ],
        },
        {
          label: 'Across the page',
          items: [
            'features/code-mentions',
            'features/line-permalinks',
            'features/fill-in-placeholders',
            'features/code-switcher',
            'features/token-transitions',
            'features/scrollycoding',
            'features/side-by-side-annotations',
          ],
        },
        {
          label: 'More',
          items: ['features/inline-code-highlighting', 'features/run-in-the-browser'],
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
      ],
    }),
  ],
  vite: {
    build: {
      rolldownOptions: {
        // @astrojs/mdx emits this directive in every .mdx page, and Rolldown warns about it.
        onLog(level, log, handler) {
          if (log.code === 'MODULE_LEVEL_DIRECTIVE' && log.message.includes('astro:head-inject')) return;
          handler(level, log);
        },
      },
    },
  },
});
