import { type Element, type Root, select, toText, visit } from '@expressive-code/core/hast';
import { fromHtml } from 'hast-util-from-html';

const MAX_WORDS = 16;

/** The first sentence of `text`, cut to `MAX_WORDS` words. */
function firstSentence(text: string) {
  // Asides in brackets go first, but not the brackets of a call such as `load()`.
  const clean = text
    .replace(/¶/g, '')
    .replace(/\s+/g, ' ')
    .replace(/ \([^()]+\)/g, '')
    .trim();
  const sentence = (clean.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? clean).replace(/[:;,]$/, '');
  const words = sentence.split(' ');
  return words.length > MAX_WORDS ? `${words.slice(0, MAX_WORDS).join(' ')}…` : sentence;
}

/**
 * A short summary of the object with the HTML id `id` on a Sphinx page: the first sentence of its description,
 * or for a module, the title after the dash ("json — JSON encoder and decoder").
 */
export function sphinxSummary(page: Root, id: string): string | undefined {
  let found: { target: Element; siblings: Element[] } | undefined;
  visit(page, 'element', (node: Element, _index, parent) => {
    if (node.properties.id !== id) return;
    found = { target: node, siblings: (parent?.children ?? []).filter((c): c is Element => c.type === 'element') };
    return false;
  });
  if (!found) return undefined;
  const { target, siblings } = found;
  let text: string | undefined;
  if (target.tagName === 'dt') {
    // Several `dt` elements can share one description.
    const dd = siblings.slice(siblings.indexOf(target) + 1).find((el) => el.tagName !== 'dt');
    const p = dd?.tagName === 'dd' ? select('p', dd) : undefined;
    text = p && toText(p);
  } else {
    const title = select('h1', target);
    text = title && toText(title).split(' — ')[1];
  }
  return text ? firstSentence(text) || undefined : undefined;
}

export const parsePage = (body: Uint8Array) => fromHtml(new TextDecoder().decode(body));
