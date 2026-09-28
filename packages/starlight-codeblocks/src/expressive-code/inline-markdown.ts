import { type ElementContent, h } from '@expressive-code/core/hast';
import { isSafeUrl } from './core.ts';

const TOKEN = /`([^`]+)`|\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

/**
 * Renders the text of a directive (a message, an annotation, a callout or a footnote).
 * Inline code, links and bold become HTML. Everything else stays text.
 */
export function inlineMarkdown(text: string): ElementContent[] {
  const nodes: ElementContent[] = [];
  let cursor = 0;
  for (const match of text.matchAll(TOKEN)) {
    const [raw, code, bold, label, href] = match;
    if (match.index > cursor) nodes.push({ type: 'text', value: text.slice(cursor, match.index) });
    if (code !== undefined) nodes.push(h('code', code));
    else if (bold !== undefined) nodes.push(h('strong', inlineMarkdown(bold)));
    else if (href && isSafeUrl(href, ['http:', 'https:', 'mailto:']))
      nodes.push(h('a', { href }, inlineMarkdown(label ?? '')));
    else nodes.push({ type: 'text', value: raw });
    cursor = match.index + raw.length;
  }
  if (cursor < text.length) nodes.push({ type: 'text', value: text.slice(cursor) });
  return nodes;
}
