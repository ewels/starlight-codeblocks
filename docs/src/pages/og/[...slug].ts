import { getCollection } from 'astro:content';
import { mkdirSync } from 'node:fs';
import { OGImageRoute } from 'astro-og-canvas';
import sharp from 'sharp';

// CanvasKit draws bitmaps only, so rasterise the SVG logo once per build.
const logo = 'node_modules/.astro/og-logo.png';
mkdirSync('node_modules/.astro', { recursive: true });
await sharp('src/assets/logo.svg', { density: 1152 }).resize({ width: 128 }).png().toFile(logo);

const entries = await getCollection('docs');

export const { getStaticPaths, GET } = await OGImageRoute({
  pages: Object.fromEntries(entries.map((entry) => [entry.id, entry.data])),
  getImageOptions: (_path, page: (typeof entries)[number]['data']) => ({
    title: page.title,
    description: page.description ?? '',
    logo: { path: logo, size: [128] },
    bgGradient: [
      [22, 26, 46],
      [36, 38, 82],
    ],
    border: { color: [91, 91, 240], width: 20, side: 'inline-start' },
    padding: 72,
    fonts: [
      'https://api.fontsource.org/v1/fonts/inter/latin-700-normal.ttf',
      'https://api.fontsource.org/v1/fonts/inter/latin-400-normal.ttf',
    ],
    font: {
      title: { families: ['Inter'], weight: 'Bold', size: 68, lineHeight: 1.2, color: [255, 255, 255] },
      description: { families: ['Inter'], size: 36, lineHeight: 1.4, color: [190, 198, 222] },
    },
  }),
});
