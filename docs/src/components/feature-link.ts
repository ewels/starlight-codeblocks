import { getEntry } from 'astro:content';
import { inlineCode } from './inline-code.ts';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

/** A link to a docs page, with the page title as its text. */
export async function featureLink(page: string) {
  const title = (await getEntry('docs', page))?.data.title ?? page;
  return `<a href="${base}/${page}/">${inlineCode(title)}</a>`;
}
