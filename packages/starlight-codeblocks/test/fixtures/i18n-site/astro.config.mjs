import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import codeblocks from '../../../dist/index.mjs';

export default defineConfig({
  site: 'https://example.com',
  integrations: [
    starlight({
      title: 'Translations',
      locales: { root: { label: 'English', lang: 'en' }, de: { label: 'Deutsch' }, pt: { label: 'Português' } },
      pagefind: false,
      disable404Route: true,
      plugins: [codeblocks({ apiLinks: false })],
    }),
  ],
});
