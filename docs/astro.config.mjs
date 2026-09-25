import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import codeblocks from 'starlight-codeblocks';

export default defineConfig({
  site: 'https://ewels.github.io',
  base: '/starlight-codeblocks',
  integrations: [
    starlight({
      title: 'starlight-codeblocks',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/ewels/starlight-codeblocks' }],
      disable404Route: true,
      plugins: [codeblocks()],
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
