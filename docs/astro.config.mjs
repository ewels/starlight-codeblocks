import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import codeblocks, { linksValidatorExclude } from 'starlight-codeblocks';
import { nextflow } from 'starlight-codeblocks/adapters/nextflow';
import { python } from 'starlight-codeblocks/adapters/python';
import starlightLinksValidator from 'starlight-links-validator';
import { codeblocksApi } from './src/adapters/codeblocks-api.mjs';
import { sidebar } from './src/sidebar.mjs';

export default defineConfig({
  site: 'https://ewels.github.io',
  base: '/starlight-codeblocks',
  integrations: [
    starlight({
      title: 'starlight-codeblocks',
      logo: { src: './src/assets/logo.svg' },
      favicon: '/favicon.svg',
      customCss: ['./src/styles/custom.css'],
      components: { Head: './src/components/Head.astro', PageTitle: './src/components/PageTitle.astro' },
      head: [{ tag: 'link', attrs: { rel: 'apple-touch-icon', href: '/starlight-codeblocks/apple-touch-icon.png' } }],
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/ewels/starlight-codeblocks' }],
      disable404Route: true,
      routeMiddleware: './src/route-data.ts',
      plugins: [
        codeblocks({
          // Markdown blocks on this site show the source that authors write, so their directives must stay as text.
          notation: { comments: { md: [], markdown: [], mdx: [] } },
          shellCopy: { prompts: ['$ ', '> ', 'PS> '] },
          playgrounds: {
            pythontutor: {
              label: 'Open in Python Tutor',
              url: ({ code }) =>
                `https://pythontutor.com/visualize.html#mode=edit&py=3&code=${encodeURIComponent(code)}`,
            },
            stackblitz: {
              label: 'Open in StackBlitz',
              post: ({ code, title }) => ({
                action: 'https://stackblitz.com/run',
                fields: {
                  'project[title]': title ?? 'Example',
                  'project[template]': 'javascript',
                  'project[files][index.js]': code,
                  'project[files][index.html]': '<script type="module" src="index.js"></script>',
                },
              }),
            },
          },
          apiLinks: {
            adapters: [
              python(),
              nextflow({
                modules: ({ name }) => ({
                  href: `https://nf-co.re/modules/${name.toLowerCase()}`,
                  kind: 'process',
                  source: 'nf-core modules',
                }),
              }),
              codeblocksApi(),
            ],
          },
          runnable: { runtimes: { javascript: './src/runtimes/javascript.ts' }, timeout: 5000 },
          lineStates: { states: { todo: { label: 'To do', colour: { dark: '#c792ea', light: '#7c3aed' } } } },
        }),
        starlightLinksValidator({ exclude: linksValidatorExclude }),
      ],
      sidebar,
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
