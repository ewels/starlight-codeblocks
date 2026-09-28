import { base, titles } from '../markdown.ts';
import { inlineCode } from './inline-code.ts';

export const pageHref = (page: string) => `${base}/${page}/`;

/** A link to a docs page, with the page title as its text. */
export const featureLink = (page: string) => `<a href="${pageHref(page)}">${inlineCode(titles.get(page) ?? page)}</a>`;
