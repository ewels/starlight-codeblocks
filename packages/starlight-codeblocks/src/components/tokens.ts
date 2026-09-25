import { type Element, type ElementContent, matches, select, selectAll } from '@expressive-code/core/hast';

export interface Token {
  content: string;
  offset: number;
  htmlStyle?: string;
}

// Decorations that other features add inside a line. Keep in step with their unselectable elements.
const DECORATIONS = [
  'button, input, select, [popover], [aria-hidden="true"]',
  '.scb-sr-only, .scb-state-label, .scb-state-prefix, .scb-callout, .scb-annotation, .scb-footnote-badge',
].join(', ');

/**
 * Reads the syntax tokens of a block that Expressive Code rendered. Each token keeps the colour variables
 * (`--0:…;--1:…`) of every span around it. Decorations, such as labels for screen readers, are left out.
 */
export function readTokens(figure: Element): { code: string; lines: Token[][] } {
  let offset = 0;
  const lines = selectAll('.ec-line', figure).map((line) => {
    const tokens: Token[] = [];
    const walk = (nodes: ElementContent[], styles: string[]) => {
      for (const node of nodes) {
        if (node.type === 'text') {
          // Expressive Code puts a line break in empty lines.
          const content = node.value.replaceAll('\n', '');
          if (!content) continue;
          tokens.push({ content, offset, htmlStyle: styles.join(';') || undefined });
          offset += content.length;
        } else if (node.type === 'element' && !matches(DECORATIONS, node)) {
          const style = String(node.properties.style ?? '');
          walk(node.children, style.startsWith('--') ? [...styles, style] : styles);
        }
      }
    };
    walk(select('.code', line)?.children ?? [], []);
    offset += 1;
    return tokens;
  });
  return { code: lines.map((tokens) => tokens.map((t) => t.content).join('')).join('\n'), lines };
}
